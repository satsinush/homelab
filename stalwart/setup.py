"""Stalwart service — RocksDB bootstrap, recovery admin, LDAP + SMTP users via postsetup."""
from __future__ import annotations

import json
import time
from pathlib import Path

from setup.service import Service, VolumeDir, write_volume_file
from setup.ui import info, ok, section, warn
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
                                        "filterLogin": (
                                            "(&(objectClass=user)(ou:dn:=users)(|(mail=?)(cn=?)))"
                                        ),
                                        "filterMailbox": (
                                            "(&(objectClass=user)(ou:dn:=users)(|(mail=?)(cn=?)))"
                                        ),
                                        "groupClass": "group",
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
        "filterLogin": "(&(objectClass=user)(ou:dn:=users)(|(mail=?)(cn=?)))",
        "filterMailbox": "(&(objectClass=user)(ou:dn:=users)(|(mail=?)(cn=?)))",
        "groupClass": "group",
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
    else:
        ok(f"Stalwart auth directory → LDAP ({directory_id})")


def _ensure_smtp_user(jmap, domain_id: str, local_part: str, password: str) -> None:
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
    # credentials is an objectList keyed by credential id (not a JSON array).
    creds = {"0": {"@type": "Password", "secret": password}}
    if ids:
        account_id = ids[0]
        resp = jmap(
            [["x:Account/set", {"update": {account_id: {"credentials": creds}}}, "c1"]]
        )
        _, update_data = _method_result(resp)
        if (update_data or {}).get("notUpdated"):
            warn(
                f"Could not update SMTP user {local_part}: "
                f"{(update_data or {}).get('notUpdated')}"
            )
        return

    create = {
        "@type": "User",
        "name": local_part,
        "domainId": domain_id,
        "credentials": creds,
        "description": f"Homelab SMTP service account ({local_part})",
    }
    resp = jmap([["x:Account/set", {"create": {"u1": create}}, "c1"]])
    name, create_data = _method_result(resp)
    if (create_data or {}).get("notCreated"):
        raise RuntimeError(
            f"SMTP user {local_part} create failed: {(create_data or {}).get('notCreated')}"
        )
    if name == "error":
        raise RuntimeError(f"SMTP user {local_part} error: {create_data}")


def configure_stalwart(env: dict) -> None:
    """Idempotent: LDAP directory + vaultwarden@/noreply@ local SMTP users."""
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
            if attempt in (0, 5, 11, 17):
                info(f"Waiting for Stalwart JMAP API… ({exc})")
            if attempt == 23:
                warn(f"Stalwart API not ready; configure manually if needed ({last_err})")
                return
            time.sleep(5)

    domain_id = _ensure_domain(jmap, domain_name)
    ldap_id = _ensure_ldap_directory(jmap, ldap_pass)
    if ldap_id:
        _ensure_auth_directory(jmap, ldap_id)
    if vw_pass:
        _ensure_smtp_user(jmap, domain_id, "vaultwarden", vw_pass)
    if nr_pass:
        _ensure_smtp_user(jmap, domain_id, "noreply", nr_pass)
    ok("Stalwart LDAP directory and SMTP service users configured")


class StalwartService(Service):
    name = "stalwart"
    volume_dirs = [
        VolumeDir("./stalwart/volumes/config", uid=2000, gid=2000, mode=0o700),
        VolumeDir("./stalwart/volumes/data", uid=2000, gid=2000, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Stalwart secrets and storage...", emoji="✉️")
        gen_secret("ldap_service_password", 32)
        gen_secret("stalwart_admin_password", 32)
        gen_secret("stalwart_smtp_vaultwarden_password", 32)
        gen_secret("stalwart_smtp_noreply_password", 32)
        if not env.get("MAIL_SERVICE_NAME"):
            append_env(env, "MAIL_SERVICE_NAME", "mail")

        # Always rewrite; config.json is only the datastore pointer (idempotent).
        # Must use write_volume_file — dir is 0700/uid 2000 (host cannot stat/write).
        write_volume_file(
            "./stalwart/volumes/config/config.json",
            json.dumps({"@type": "RocksDb", "path": "/var/lib/stalwart/"}) + "\n",
            mode=0o600,
            uid=_STALWART_UID,
            gid=_STALWART_GID,
        )
        ok("Stalwart RocksDB bootstrap configuration written")

        hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
        mail = env.get("MAIL_SERVICE_NAME", "mail")
        info(f"Stalwart admin UI: https://{mail}.{hostname}")
        info("Recovery admin comes from volumes/secrets/stalwart_admin_password via entrypoint")
        info("Postsetup will configure Authentik LDAP + vaultwarden@/noreply@ SMTP users")

    def postsetup(self, env: dict) -> None:
        section("Configuring Stalwart (LDAP + SMTP users)...", emoji="✉️")
        try:
            configure_stalwart(env)
        except Exception as exc:
            warn(f"Stalwart auto-configure failed: {exc}")
            warn(
                "Retry later or finish in WebUI: LDAP → authentik-ldap:3389; "
                "local users vaultwarden@ / noreply@"
            )


service = StalwartService()
