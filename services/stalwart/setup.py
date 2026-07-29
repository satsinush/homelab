"""Stalwart service — RocksDB bootstrap, recovery admin, LDAP + SMTP users via postsetup."""
from __future__ import annotations

import json
import time
from pathlib import Path

from setup.service import Service, VolumeDir, write_volume_file
from setup.ui import ok, warn
from setup.utils import append_env, gen_secret

_STALWART_UID = 2000
_STALWART_GID = 2000


def _secret(name: str) -> str:
    path = Path("./volumes/secrets") / name
    return path.read_text(encoding="utf-8").strip() if path.is_file() else ""


def _jmap(user: str, password: str, method_calls: list) -> dict:
    """Call Stalwart JMAP management API via curl inside the stalwart container.

    Stalwart 0.16+ dropped the REST ``/api`` surface; management is JMAP at ``/jmap``.
    Calling localhost inside the container avoids public ``apiUrl`` DNS and fragile
    throwaway ``python -c`` one-liners.
    """
    import subprocess

    payload = json.dumps(
        {
            "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
            "methodCalls": method_calls,
        }
    )
    res = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "stalwart",
            "curl",
            "-sS",
            "-f",
            "-u",
            f"{user}:{password}",
            "-H",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
            "http://127.0.0.1:8080/jmap",
        ],
        input=payload,
        capture_output=True,
        text=True,
        check=False,
    )
    out = (res.stdout or "").strip()
    if res.returncode != 0 or not out.startswith("{"):
        err = (res.stderr or "").strip() or out
        raise RuntimeError(f"Stalwart JMAP call failed: {err[:400]}")
    return json.loads(out)


def _method_result(resp: dict, call_id: str = "c1"):
    for item in resp.get("methodResponses") or []:
        if len(item) >= 3 and item[2] == call_id:
            return item[0], item[1]
    return None, None


def _ensure_domain(jmap, domain_name: str) -> str:
    resp = jmap([["x:Domain/query", {"filter": {"name": domain_name}}, "c1"]])
    _, data = _method_result(resp)
    ids = list((data or {}).get("ids") or [])
    if ids:
        return ids[0]
    # Stalwart 0.16+: omit empty aliases (type set) and nested management defaults.
    resp = jmap([["x:Domain/set", {"create": {"d1": {"name": domain_name}}}, "c1"]])
    name, data = _method_result(resp)
    created = (data or {}).get("created") or {}
    if "d1" in created and created["d1"].get("id"):
        return created["d1"]["id"]
    not_created = (data or {}).get("notCreated") or {}
    if not_created:
        raise RuntimeError(f"Domain create failed: {not_created}")
    raise RuntimeError(f"Domain create unexpected response: {name} {data}")


def _ensure_ldap_directory(jmap, ldap_pass: str) -> str | None:
    """Ensure Authentik LDAP directory exists; return its id."""
    resp = jmap([["x:Directory/query", {"filter": {}}, "c1"]])
    _, data = _method_result(resp)
    ids = list((data or {}).get("ids") or [])
    if ids:
        get_resp = jmap([["x:Directory/get", {"ids": ids}, "c1"]])
        _, get_data = _method_result(get_resp)
        for obj in (get_data or {}).get("list") or []:
            if obj.get("@type") == "Ldap" and "Authentik" in (obj.get("description") or ""):
                jmap(
                    [
                        [
                            "x:Directory/set",
                            {
                                "update": {
                                    obj["id"]: {
                                        # objectClass=user already excludes Authentik
                                        # virtual-groups. ou:dn:=users returns Operations
                                        # error on Authentik's LDAP outpost.
                                        "filterLogin": (
                                            "(&(objectClass=user)(|(mail=?)(cn=?)))"
                                        ),
                                        "filterMailbox": (
                                            "(&(objectClass=user)(|(mail=?)(cn=?)))"
                                        ),
                                        "filterMemberOf": (
                                            "(&(objectClass=group)(member=?))"
                                        ),
                                        "groupClass": "group",
                                        # Authentik exposes pwdChangedTime (not pwdChangeTime).
                                        "attrSecretChanged": {"pwdChangedTime": True},
                                        "bindSecret": {
                                            "@type": "Value",
                                            "secret": ldap_pass,
                                        },
                                    }
                                }
                            },
                            "c1",
                        ]
                    ]
                )
                return obj["id"]
    create = {
        "@type": "Ldap",
        "description": "Authentik LDAP",
        "url": "ldap://authentik-ldap:3389",
        "baseDn": "dc=ldap,dc=goauthentik,dc=io",
        "bindDn": "cn=ldapservice,ou=users,dc=ldap,dc=goauthentik,dc=io",
        "bindSecret": {"@type": "Value", "secret": ldap_pass},
        "bindAuthentication": True,
        "filterLogin": "(&(objectClass=user)(|(mail=?)(cn=?)))",
        "filterMailbox": "(&(objectClass=user)(|(mail=?)(cn=?)))",
        "filterMemberOf": "(&(objectClass=group)(member=?))",
        "groupClass": "group",
        "attrSecretChanged": {"pwdChangedTime": True},
    }
    resp = jmap([["x:Directory/set", {"create": {"ldap1": create}}, "c1"]])
    name, data = _method_result(resp)
    if (data or {}).get("notCreated"):
        raise RuntimeError(f"LDAP directory create failed: {(data or {}).get('notCreated')}")
    if name == "error":
        raise RuntimeError(f"LDAP directory create error: {data}")
    created = (data or {}).get("created") or {}
    return (created.get("ldap1") or {}).get("id")


def _ensure_auth_directory(jmap, directory_id: str) -> None:
    """Point Authentication.directoryId at the Authentik LDAP directory."""
    if not directory_id:
        return
    resp = jmap(
        [
            [
                "x:Authentication/set",
                {"update": {"singleton": {"directoryId": directory_id}}},
                "c1",
            ]
        ]
    )
    name, data = _method_result(resp)
    if (data or {}).get("notUpdated"):
        warn(f"Could not set Authentication.directoryId: {(data or {}).get('notUpdated')}")
    elif name == "error":
        warn(f"Authentication.directoryId error: {data}")


def _ensure_default_domain(jmap, domain_id: str, mail_hostname: str) -> None:
    """Point SystemSettings at the homelab domain (bare usernames append this).

    Fresh installs leave defaultDomainId as a placeholder (p333333333333), so
    ``andrew`` becomes ``andrew@localhost.local`` and LDAP login fails.
    """
    if not domain_id:
        return
    update: dict = {"defaultDomainId": domain_id}
    if mail_hostname:
        update["defaultHostname"] = mail_hostname
    resp = jmap(
        [["x:SystemSettings/set", {"update": {"singleton": update}}, "c1"]]
    )
    name, data = _method_result(resp)
    if (data or {}).get("notUpdated"):
        warn(f"Could not set default domain: {(data or {}).get('notUpdated')}")
    elif name == "error":
        warn(f"SystemSettings.defaultDomainId error: {data}")


def _restart_stalwart() -> None:
    """Reload LDAP directory / system settings into the running process."""
    import subprocess

    res = subprocess.run(
        ["docker", "restart", "stalwart"],
        capture_output=True,
        text=True,
        check=False,
    )
    if res.returncode != 0:
        warn(f"Could not restart Stalwart after configure: {(res.stderr or res.stdout)[:300]}")
        return


def _ensure_tls_certificate(jmap, env: dict) -> None:
    """Register the Homelab wildcard cert as Stalwart's default TLS certificate.

    Covers mail.<HOMELAB_HOSTNAME> (SAN ``*.homelab.home.arpa``). Cert/key are
    copied into the RocksDB config volume so uid 2000 can read them.
    """
    hostname = (env.get("HOMELAB_HOSTNAME") or "homelab.home.arpa").strip()
    # Prefer hostname-specific cert; fall back to stable Traefik/homelab copies.
    candidates = [
        (f"./volumes/certificates/{hostname}.crt", f"./volumes/certificates/{hostname}.key"),
        ("./volumes/certificates/homelab.crt", "./volumes/certificates/homelab.key"),
    ]
    cert_src: str | None = None
    key_src: str | None = None
    for c, k in candidates:
        if Path(c).is_file() and Path(k).is_file():
            cert_src, key_src = c, k
            break
    if not cert_src or not key_src:
        warn("No Homelab TLS cert found under volumes/certificates; Stalwart keeps self-signed")
        return

    cert_pem = Path(cert_src).read_text(encoding="utf-8")
    key_pem = Path(key_src).read_text(encoding="utf-8")
    write_volume_file(
        "./services/stalwart/volumes/config/certs/fullchain.pem",
        cert_pem if cert_pem.endswith("\n") else cert_pem + "\n",
        mode=0o644,
        uid=_STALWART_UID,
        gid=_STALWART_GID,
    )
    write_volume_file(
        "./services/stalwart/volumes/config/certs/privkey.pem",
        key_pem if key_pem.endswith("\n") else key_pem + "\n",
        mode=0o600,
        uid=_STALWART_UID,
        gid=_STALWART_GID,
    )

    cert_path = "/etc/stalwart/certs/fullchain.pem"
    key_path = "/etc/stalwart/certs/privkey.pem"
    create = {
        "certificate": {"@type": "File", "filePath": cert_path},
        "privateKey": {"@type": "File", "filePath": key_path},
    }

    resp = jmap([["x:Certificate/query", {"filter": {}}, "c1"]])
    _, data = _method_result(resp)
    ids = list((data or {}).get("ids") or [])
    cert_id = None
    if ids:
        get_resp = jmap([["x:Certificate/get", {"ids": ids}, "c1"]])
        _, get_data = _method_result(get_resp)
        for obj in (get_data or {}).get("list") or []:
            sans = obj.get("subjectAlternativeNames") or {}
            if f"*.{hostname}" in sans or hostname in sans:
                # Refresh file pointers (idempotent).
                jmap([["x:Certificate/set", {"update": {obj["id"]: create}}, "c1"]])
                cert_id = obj["id"]
                break
    if not cert_id:
        resp = jmap([["x:Certificate/set", {"create": {"c1": create}}, "c1"]])
        name, cdata = _method_result(resp)
        if (cdata or {}).get("notCreated"):
            warn(f"Could not create Stalwart TLS certificate: {(cdata or {}).get('notCreated')}")
            return
        if name == "error":
            warn(f"Stalwart TLS certificate error: {cdata}")
            return
        cert_id = ((cdata or {}).get("created") or {}).get("c1", {}).get("id")
    if not cert_id:
        warn("Stalwart TLS certificate id missing after create/update")
        return

    jmap(
        [
            [
                "x:SystemSettings/set",
                {"update": {"singleton": {"defaultCertificateId": cert_id}}},
                "c1",
            ]
        ]
    )
    jmap(
        [
            [
                "x:Action/set",
                {"create": {"a1": {"@type": "ReloadTlsCertificates"}}},
                "c1",
            ]
        ]
    )


def _destroy_local_smtp_accounts(jmap, domain_id: str, local_parts: list[str]) -> None:
    """Remove leftover local Stalwart users; auth comes from Authentik LDAP."""
    for local_part in local_parts:
        resp = jmap(
            [
                [
                    "x:Account/query",
                    {"filter": {"name": local_part, "domainId": domain_id}},
                    "c1",
                ]
            ]
        )
        _, query_data = _method_result(resp)
        ids = [i for i in list((query_data or {}).get("ids") or []) if i]
        if not ids:
            continue
        resp = jmap([["x:Account/set", {"destroy": ids}, "c1"]])
        _, data = _method_result(resp)
        if (data or {}).get("notDestroyed"):
            warn(f"Could not destroy local {local_part}: {(data or {}).get('notDestroyed')}")


def _ensure_mail_webhook(jmap) -> None:
    """POST message-ingest.* events to the alerts gateway → Gotify Mail app."""
    url = "http://alerts/stalwart"
    # Stalwart JMAP expects EventType sets as {event: true}, not string arrays.
    events = {
        "message-ingest.ham": True,
        "message-ingest.spam": True,
    }
    create = {
        "url": url,
        "events": events,
        "eventsPolicy": "include",
        "enable": True,
        "lossy": True,
        "allowInvalidCerts": False,
        "httpAuth": {"@type": "Unauthenticated"},
        "httpHeaders": {},
        "signatureKey": {"@type": "None"},
    }

    resp = jmap([["x:WebHook/query", {"filter": {}}, "c1"]])
    _, data = _method_result(resp)
    ids = list((data or {}).get("ids") or [])
    existing_id = None
    if ids:
        get_resp = jmap([["x:WebHook/get", {"ids": ids}, "c1"]])
        _, get_data = _method_result(get_resp)
        for obj in (get_data or {}).get("list") or []:
            if (obj.get("url") or "").rstrip("/") == url:
                existing_id = obj.get("id")
                break
    if existing_id:
        resp = jmap([["x:WebHook/set", {"update": {existing_id: create}}, "c1"]])
        name, udata = _method_result(resp)
        if (udata or {}).get("notUpdated"):
            warn(f"Could not update Stalwart mail webhook: {(udata or {}).get('notUpdated')}")
            return
        if name == "error":
            warn(f"Stalwart mail webhook update error: {udata}")
        return

    resp = jmap([["x:WebHook/set", {"create": {"w1": create}}, "c1"]])
    name, cdata = _method_result(resp)
    if (cdata or {}).get("notCreated"):
        warn(f"Could not create Stalwart mail webhook: {(cdata or {}).get('notCreated')}")
        return
    if name == "error":
        warn(f"Stalwart mail webhook create error: {cdata}")


def _ensure_authentik_smtp_user(username: str, email: str, password: str) -> None:
    """Create/update an Authentik service user so Stalwart LDAP SMTP auth works.

    Blueprint declares these users; this refreshes passwords after secret rotation.
    """
    import subprocess

    if not password:
        return
    script = (
        "import os\n"
        "from authentik.core.models import User, UserTypes\n"
        "u, created = User.objects.get_or_create(\n"
        "    username=os.environ['SMTP_USER'],\n"
        "    defaults={\n"
        "        'email': os.environ['SMTP_EMAIL'],\n"
        "        'name': os.environ['SMTP_USER'],\n"
        "        'type': UserTypes.SERVICE_ACCOUNT,\n"
        "    },\n"
        ")\n"
        "u.email = os.environ['SMTP_EMAIL']\n"
        "u.name = os.environ['SMTP_USER']\n"
        "u.type = UserTypes.SERVICE_ACCOUNT\n"
        "u.set_password(os.environ['SMTP_PASS'])\n"
        "u.save()\n"
        "print(('created' if created else 'updated'), u.username)\n"
    )
    res = subprocess.run(
        [
            "docker",
            "exec",
            "-e",
            f"SMTP_USER={username}",
            "-e",
            f"SMTP_EMAIL={email}",
            "-e",
            f"SMTP_PASS={password}",
            "-i",
            "authentik-worker",
            "ak",
            "shell",
        ],
        input=script,
        capture_output=True,
        text=True,
        check=False,
    )
    out = (res.stdout or "") + (res.stderr or "")
    if res.returncode != 0 or "Traceback" in out:
        warn(f"Authentik SMTP user {username} failed: {out[-400:]}")
    elif "created" not in out and "updated" not in out:
        warn(f"Authentik SMTP user {username}: unexpected output")


def configure_stalwart(env: dict) -> None:
    """Idempotent: TLS cert, LDAP auth, Authentik SMTP service users."""
    admin_pass = _secret("stalwart_admin_password")
    ldap_pass = _secret("ldap_service_password")
    vw_pass = _secret("stalwart_smtp_vaultwarden_password")
    nr_pass = _secret("stalwart_smtp_noreply_password")
    if not admin_pass:
        warn("stalwart_admin_password missing; skip Stalwart configure")
        return
    if not ldap_pass:
        warn("ldap_service_password missing; skip Stalwart LDAP")
        return

    domain_name = (env.get("HOMELAB_HOSTNAME") or "homelab.home.arpa").strip()

    def jmap(calls: list) -> dict:
        return _jmap("admin", admin_pass, calls)

    # Wait for management API (JMAP /jmap — not the removed REST /api).
    last_err: Exception | None = None
    for attempt in range(24):
        try:
            jmap([["x:Domain/query", {"filter": {}}, "c1"]])
            break
        except Exception as exc:
            last_err = exc
            if attempt == 23:
                warn(f"Stalwart API not ready; configure manually if needed ({last_err})")
                return
            time.sleep(5)

    mail_svc = (env.get("MAIL_SERVICE_NAME") or "mail").strip()
    mail_hostname = f"{mail_svc}.{domain_name}" if domain_name else ""

    domain_id = _ensure_domain(jmap, domain_name)
    _ensure_default_domain(jmap, domain_id, mail_hostname)
    _ensure_tls_certificate(jmap, env)
    ldap_id = _ensure_ldap_directory(jmap, ldap_pass)
    if ldap_id:
        _ensure_auth_directory(jmap, ldap_id)

    # Drop legacy local SMTP users; mailboxes materialize via LDAP on first auth.
    _destroy_local_smtp_accounts(jmap, domain_id, ["vaultwarden", "noreply"])
    if vw_pass:
        _ensure_authentik_smtp_user(
            "vaultwarden", f"vaultwarden@{domain_name}", vw_pass
        )
    if nr_pass:
        _ensure_authentik_smtp_user("noreply", f"noreply@{domain_name}", nr_pass)

    _ensure_mail_webhook(jmap)

    # Directory + SystemSettings changes are not always live until restart;
    # without this, LDAP auth can keep failing until a manual docker restart.
    _restart_stalwart()
    # Wait for API again so later postsetup steps (if any) see a healthy server.
    for attempt in range(24):
        try:
            _jmap("admin", admin_pass, [["x:Domain/query", {"filter": {}}, "c1"]])
            break
        except Exception as exc:
            if attempt == 23:
                warn(f"Stalwart did not become ready after restart ({exc})")
                return
            time.sleep(2)
    # Re-apply TLS after restart (ReloadTlsCertificates is enough if files unchanged).
    try:
        _ensure_tls_certificate(
            lambda calls: _jmap("admin", admin_pass, calls), env
        )
    except Exception as exc:
        warn(f"TLS re-apply after restart: {exc}")
    ok("Stalwart configured")


class StalwartService(Service):
    name = "stalwart"
    volume_dirs = [
        VolumeDir("./services/stalwart/volumes/config", uid=2000, gid=2000, mode=0o700),
        VolumeDir("./services/stalwart/volumes/data", uid=2000, gid=2000, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("ldap_service_password", 32)
        gen_secret("stalwart_admin_password", 32)
        gen_secret("stalwart_smtp_vaultwarden_password", 32)
        gen_secret("stalwart_smtp_noreply_password", 32)
        if not env.get("MAIL_SERVICE_NAME"):
            append_env(env, "MAIL_SERVICE_NAME", "mail")

        # Always rewrite; config.json is only the datastore pointer (idempotent).
        # Must use write_volume_file — dir is 0700/uid 2000 (host cannot stat/write).
        write_volume_file(
            "./services/stalwart/volumes/config/config.json",
            json.dumps({"@type": "RocksDb", "path": "/var/lib/stalwart/"}) + "\n",
            mode=0o600,
            uid=_STALWART_UID,
            gid=_STALWART_GID,
        )

    def postsetup(self, env: dict) -> None:
        try:
            configure_stalwart(env)
        except Exception as exc:
            warn(f"Stalwart auto-configure failed: {exc}")
            warn(
                "Retry later or finish in WebUI: LDAP → authentik-ldap:3389; "
                "local users vaultwarden@ / noreply@"
            )


service = StalwartService()
