"""Nextcloud + Collabora — volumes, secrets, richdocuments wiring."""
from __future__ import annotations

import json
from pathlib import Path

from setup.service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import ok, warn
from setup.utils import append_env, authentik_group_usernames, docker_exec, gen_secret, run_cmd, wait_for


def _occ(*args: str, check: bool = True) -> str:
    """Run occ as www-data (required for correct app permissions)."""
    return (
        run_cmd(
            "docker exec -u www-data nextcloud php occ "
            + " ".join(__import__("shlex").quote(a) for a in args),
            check=check,
        )
        or ""
    )


def _nextcloud_ready() -> bool:
    out = _occ("status", check=False) or ""
    return "installed: true" in out and "maintenance: false" in out


def _app_enabled(app_id: str) -> bool:
    out = _occ("app:list", "--output=json", check=False) or ""
    try:
        data = json.loads(out)
        return app_id in (data.get("enabled") or {})
    except Exception:
        return False


def _richdocuments_enabled() -> bool:
    return _app_enabled("richdocuments")


def _ensure_ca_trust() -> None:
    """Trust the homelab CA inside Nextcloud (mounted under ca-certificates)."""
    run_cmd("docker exec nextcloud update-ca-certificates", check=False)


def _install_app_from_github(app_id: str, url: str) -> bool:
    """App-store installs are flaky; drop a release tarball into custom_apps."""
    script = (
        "set -eu; "
        "mkdir -p /var/www/html/custom_apps; "
        "cd /var/www/html/custom_apps; "
        f"rm -rf {app_id}; "
        f"curl -fsSL -o /tmp/{app_id}.tar.gz {url!r}; "
        f"tar -xzf /tmp/{app_id}.tar.gz; "
        f"rm -f /tmp/{app_id}.tar.gz; "
        f"chown -R www-data:www-data {app_id}; "
        f"test -f {app_id}/appinfo/info.xml"
    )
    out = run_cmd(f"docker exec nextcloud sh -c {json.dumps(script)}", check=False)
    if out is None:
        return False
    _occ("app:enable", app_id, check=False)
    return _app_enabled(app_id)


def _ensure_app(app_id: str, github_url: str) -> bool:
    if _app_enabled(app_id):
        return True
    _occ("app:install", app_id, check=False)
    _occ("app:enable", app_id, check=False)
    if _app_enabled(app_id):
        return True
    warn(f"App store install failed for {app_id}; trying GitHub release…")
    return _install_app_from_github(app_id, github_url)


def _install_richdocuments_from_github() -> bool:
    return _install_app_from_github(
        "richdocuments",
        "https://github.com/nextcloud-releases/richdocuments/releases/download/"
        "v10.1.3/richdocuments-v10.1.3.tar.gz",
    )


def _ensure_richdocuments_app() -> bool:
    return _ensure_app(
        "richdocuments",
        "https://github.com/nextcloud-releases/richdocuments/releases/download/"
        "v10.1.3/richdocuments-v10.1.3.tar.gz",
    )


def _smb_mount_id(mount_point: str) -> str:
    """Return files_external mount id for ``mount_point``, or ''."""
    out = _occ("files_external:list", "--output=json", check=False) or ""
    try:
        mounts = json.loads(out)
    except json.JSONDecodeError:
        return ""
    if not isinstance(mounts, list):
        return ""
    want = mount_point.strip("/")
    for m in mounts:
        if not isinstance(m, dict):
            continue
        point = str(m.get("mount_point") or m.get("mountPoint") or "").strip("/")
        if point != want:
            continue
        mid = m.get("mount_id", m.get("id"))
        return str(mid) if mid is not None else ""
    return ""


def _ensure_smb_external(env: dict) -> None:
    """Enable files_external and mount Samba ``shared`` for NC admins only.

    Visible only to Nextcloud group ``admin`` (Authentik ``homelab-admins`` get
    that group via the nextcloud OIDC scope). Auth to Samba uses the bootstrap
    Authentik user + ``homelab_password``.
    """
    if not wait_for(_nextcloud_ready, timeout=120, interval=5):
        warn("Nextcloud not ready; skip SMB external storage")
        return

    _occ("app:enable", "files_external", check=False)
    if not _app_enabled("files_external"):
        warn("Could not enable files_external")
        return

    backends = _occ("files_external:backends", check=False) or ""
    if "smb" not in backends.lower():
        warn(
            "SMB backend unavailable — rebuild Nextcloud image with smbclient "
            "(services/nextcloud/Dockerfile)"
        )
        return

    mount_point = "Shared"
    mount_id = _smb_mount_id(mount_point)

    if not mount_id:
        username = (env.get("HOMELAB_USERNAME") or "").strip()
        pw_path = Path("./volumes/secrets/homelab_password")
        if not username or not pw_path.is_file():
            warn("HOMELAB_USERNAME / homelab_password missing; skip SMB Shared mount")
            return
        password = pw_path.read_text(encoding="utf-8").strip()
        if not password:
            warn("homelab_password empty; skip SMB Shared mount")
            return

        out = _occ(
            "files_external:create",
            mount_point,
            "smb",
            "password::password",
            "-c",
            "host=samba",
            "-c",
            "share=shared",
            "-c",
            "domain=WORKGROUP",
            "-c",
            f"user={username}",
            "-c",
            f"password={password}",
            check=False,
        ) or ""
        mount_id = _smb_mount_id(mount_point)
        if not mount_id:
            warn(f"SMB Shared mount failed: {out[:400]}")
            return

    # Restrict to Nextcloud "admin" group (not globally applicable).
    _occ(
        "files_external:applicable",
        mount_id,
        "--add-group=admin",
        check=False,
    )
    ok("Nextcloud external storage: Shared → smb://samba/shared (admin group only)")


def _ensure_groupware_apps(env: dict) -> None:
    if not wait_for(_nextcloud_ready, timeout=120, interval=5):
        warn("Nextcloud not ready; skip calendar/contacts/tasks/mail")
        return
    cal_ok = _ensure_app(
        "calendar",
        "https://github.com/nextcloud-releases/calendar/releases/download/"
        "v6.5.1/calendar-v6.5.1.tar.gz",
    )
    contacts_ok = _ensure_app(
        "contacts",
        "https://github.com/nextcloud-releases/contacts/releases/download/"
        "v8.3.16/contacts-v8.3.16.tar.gz",
    )
    tasks_ok = _ensure_app(
        "tasks",
        "https://github.com/nextcloud/tasks/releases/download/"
        "v0.18.1/tasks.tar.gz",
    )
    mail_ok = _ensure_app(
        "mail",
        "https://github.com/nextcloud-releases/mail/releases/download/"
        "v5.10.9/mail-v5.10.9.tar.gz",
    )
    _disable_example_groupware_content()
    if not (cal_ok and contacts_ok and tasks_ok):
        if not cal_ok:
            warn("Could not enable calendar")
        if not contacts_ok:
            warn("Could not enable contacts")
        if not tasks_ok:
            warn("Could not enable tasks")
    if mail_ok:
        _configure_mail_for_stalwart(env)
    else:
        warn("Could not enable mail")


def _disable_example_groupware_content() -> None:
    """Stop seeding example_contact.vcf / example_event.ics on first login."""
    for key, value in (
        ("enableDefaultContact", "no"),
        ("create_example_event", "no"),
    ):
        out = _occ(
            "config:app:set",
            "dav",
            key,
            f"--value={value}",
            check=False,
        ) or ""
        if "error" in out.lower():
            warn(f"dav {key} disable failed: {out[:200]}")
            return


def _mail_hostname(env: dict) -> str:
    domain = (env.get("HOMELAB_HOSTNAME") or "homelab.home.arpa").strip()
    svc = (env.get("MAIL_SERVICE_NAME") or "mail").strip()
    return f"{svc}.{domain}"


def _configure_mail_for_stalwart(env: dict) -> None:
    """Point Nextcloud Mail at Stalwart via the canonical mail hostname.

    Stalwart only listens on IMAPS 993 / SMTPS 465 in this stack (plain 143/587
    are refused). TLS is the Homelab wildcard cert (SAN ``*.homelab.home.arpa``);
    peer verify stays on — Nextcloud trusts the Homelab CA via ``_ensure_ca_trust``.

    Do **not** use ``oc_mail_provisionings``: Authentik OIDC logins never give
    Nextcloud a password, so provisioned mailboxes are created empty and show
    "Connection failed" with no user-facing delete. Accounts are created via
    ``mail:account:create`` instead (see ``_ensure_homelab_mail_account``).
    """
    domain = (env.get("HOMELAB_HOSTNAME") or "homelab.home.arpa").strip()
    mail_host = _mail_hostname(env)
    _ensure_ca_trust()
    # Already set for OIDC discovery; required so Mail can reach ``mail.<domain>``.
    _occ(
        "config:system:set",
        "allow_local_remote_servers",
        "--type=boolean",
        "--value=true",
        check=False,
    )
    _occ(
        "config:system:set",
        "app.mail.verify-tls-peer",
        "--type=boolean",
        "--value=true",
        check=False,
    )
    # Wipe any leftover provisioning (UI or older setup) so OIDC users are not
    # given a second broken mailbox on every Mail page load. Drop provisioned
    # accounts only; keep manually created ones (provisioning_id IS NULL).
    run_cmd(
        "docker exec -i nextcloud-db psql -U nextcloud -d nextcloud -v ON_ERROR_STOP=1 "
        "-c \"DELETE FROM oc_mail_messages WHERE mailbox_id IN ("
        "SELECT id FROM oc_mail_mailboxes WHERE account_id IN ("
        "SELECT id FROM oc_mail_accounts WHERE provisioning_id IS NOT NULL));"
        "DELETE FROM oc_mail_mailboxes WHERE account_id IN ("
        "SELECT id FROM oc_mail_accounts WHERE provisioning_id IS NOT NULL);"
        "DELETE FROM oc_mail_aliases WHERE account_id IN ("
        "SELECT id FROM oc_mail_accounts WHERE provisioning_id IS NOT NULL);"
        "DELETE FROM oc_mail_local_messages WHERE account_id IN ("
        "SELECT id FROM oc_mail_accounts WHERE provisioning_id IS NOT NULL);"
        "DELETE FROM oc_mail_accounts WHERE provisioning_id IS NOT NULL;"
        "DELETE FROM oc_mail_provisionings;\"",
        check=False,
    )


def _ensure_homelab_mail_account(env: dict) -> None:
    """Create or refresh a Mail account for HOMELAB_USERNAME when that NC user exists."""
    if not _app_enabled("mail"):
        return
    username = (env.get("HOMELAB_USERNAME") or "").strip()
    domain = (env.get("HOMELAB_HOSTNAME") or "homelab.home.arpa").strip()
    if not username:
        return
    email = f"{username}@{domain}"
    pw_path = Path("./volumes/secrets/homelab_password")
    if not pw_path.is_file():
        return
    password = pw_path.read_text(encoding="utf-8").strip()
    if not password:
        return

    users_json = _occ("user:list", "--output=json", check=False) or ""
    try:
        users = json.loads(users_json)
    except Exception:
        users = {}
    # OIDC may use a hashed uid with display name = username.
    user_id = None
    if username in users:
        user_id = username
    else:
        for uid, display in (users or {}).items():
            if str(display).strip().lower() == username.lower():
                user_id = uid
                break
    if not user_id:
        return

    safe_uid = user_id.replace("'", "''")
    safe_email = email.replace("'", "''")
    account_id = (
        run_cmd(
            "docker exec -i nextcloud-db psql -U nextcloud -d nextcloud -tAc "
            + json.dumps(
                "SELECT id FROM oc_mail_accounts "
                f"WHERE user_id = '{safe_uid}' AND email = '{safe_email}' "
                "AND provisioning_id IS NULL "
                "ORDER BY id LIMIT 1;"
            ),
            check=False,
        )
        or ""
    ).strip()

    mail_host = _mail_hostname(env)
    if account_id.isdigit():
        out = (
            _occ(
                "mail:account:update",
                account_id,
                f"--imap-host={mail_host}",
                "--imap-port=993",
                "--imap-ssl-mode=ssl",
                f"--imap-user={email}",
                f"--imap-password={password}",
                f"--smtp-host={mail_host}",
                "--smtp-port=465",
                "--smtp-ssl-mode=ssl",
                f"--smtp-user={email}",
                f"--smtp-password={password}",
                check=False,
            )
            or ""
        )
        if "updated" not in out.lower() and "error" in out.lower():
            warn(f"mail:account:update: {out[:400]}")
        return

    out = (
        _occ(
            "mail:account:create",
            user_id,
            username,
            email,
            mail_host,
            "993",
            "ssl",
            email,
            password,
            mail_host,
            "465",
            "ssl",
            email,
            password,
            check=False,
        )
        or ""
    )
    if "error" in out.lower() and "already" not in out.lower():
        warn(f"mail:account:create: {out[:400]}")


def _ensure_oidc(env: dict) -> None:
    """Install user_oidc and point it at Authentik (auto-provision on first login)."""
    if not wait_for(_nextcloud_ready, timeout=120, interval=5):
        warn("Nextcloud not ready; skip OIDC")
        return

    _ensure_ca_trust()
    # Discovery calls Authentik over the public hostname (extra_hosts → Traefik).
    _occ("config:system:set", "allow_local_remote_servers", "--type=boolean", "--value=true", check=False)

    oidc_ok = _ensure_app(
        "user_oidc",
        "https://github.com/nextcloud-releases/user_oidc/releases/download/"
        "v8.10.1/user_oidc-v8.10.1.tar.gz",
    )
    if not oidc_ok:
        warn("Could not install user_oidc")
        return

    auth = env.get("AUTHENTIK_SERVICE_NAME", "auth")
    host = env.get("HOMELAB_HOSTNAME", "homelab.local")
    cloud = f"{env.get('NEXTCLOUD_SERVICE_NAME', 'cloud')}.{host}"
    discovery = f"https://{auth}.{host}/application/o/nextcloud/"
    end_session = f"{discovery}end-session/"
    post_logout = f"https://{cloud}/"
    secret = Path("./volumes/secrets/nextcloud_oidc_secret").read_text(encoding="utf-8").strip()

    # unique-uid=0 → use IdP claim as NC uid (not a provider-hashed id).
    # mapping-uid=preferred_username → Authentik username (stable for SMB paths too).
    # endsession + id_token_hint required for logout (/apps/user_oidc/sls) to work.
    # Authentik "nextcloud" scope sends quota (+ groups/admin) at provision/login.
    out = _occ(
        "user_oidc:provider",
        "Authentik",
        "--clientid=nextcloud",
        f"--clientsecret={secret}",
        f"--discoveryuri={discovery}",
        f"--endsessionendpointuri={end_session}",
        f"--postlogouturi={post_logout}",
        "--send-id-token-hint=1",
        "--scope=openid profile email nextcloud",
        "--unique-uid=0",
        "--mapping-uid=preferred_username",
        "--mapping-email=email",
        "--mapping-display-name=name",
        "--mapping-quota=quota",
        "--mapping-groups=groups",
        "--group-provisioning=1",
        check=False,
    ) or ""
    # Make OIDC the default login; break-glass: https://cloud…/login?direct=1
    _occ(
        "config:app:set",
        "user_oidc",
        "allow_multiple_user_backends",
        "--value=0",
        check=False,
    )
    if "error" in out.lower() and "already" not in out.lower():
        warn(f"user_oidc:provider: {out[:400]}")


def _configure_richdocuments(env: dict) -> None:
    """Install Nextcloud Office and point it at Collabora (idempotent)."""
    office = f"{env.get('COLLABORA_SERVICE_NAME', 'office')}.{env.get('HOMELAB_HOSTNAME')}"
    public_wopi = f"https://{office}"
    # Server-side discovery over the Docker network (no Traefik/TLS needed).
    internal_wopi = "http://collabora:9980"

    if not wait_for(_nextcloud_ready, timeout=180, interval=5):
        warn("Nextcloud not ready; skip Collabora wiring")
        return

    # Probe discovery from Nextcloud (Collabora image has no curl / --probe).
    if not wait_for(
        lambda: bool(
            run_cmd(
                "docker exec nextcloud curl -sf http://collabora:9980/hosting/discovery",
                check=False,
            )
        ),
        timeout=300,
        interval=5,
    ):
        warn("Collabora discovery not reachable; skip Collabora wiring")
        return

    _ensure_ca_trust()
    if not _ensure_richdocuments_app():
        warn("Could not install/enable richdocuments")
        return

    _occ(
        "config:app:set",
        "richdocuments",
        "wopi_url",
        f"--value={internal_wopi}",
        check=False,
    )
    # Collabora callbacks originate from the Docker network.
    _occ(
        "config:app:set",
        "richdocuments",
        "wopi_allowlist",
        "--value=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7,fe80::/10",
        check=False,
    )

    activate = _occ("richdocuments:activate-config", check=False) or ""
    # activate-config rewrites public_wopi_url from discovery (internal host) —
    # force the Traefik URL browsers actually use.
    _occ(
        "config:app:set",
        "richdocuments",
        "public_wopi_url",
        f"--value={public_wopi}",
        check=False,
    )
    # Clear any leftover internal callback (must match Collabora aliasgroup).
    _occ("config:app:delete", "richdocuments", "wopi_callback_url", check=False)
    # Docker Desktop kit setup is slow; default 15s is too tight.
    _occ(
        "config:app:set",
        "richdocuments",
        "timeout",
        "--value=60",
        check=False,
    )
    if "error" in activate.lower() and "configured" not in activate.lower():
        warn(f"richdocuments:activate-config: {activate[:400]}")


def _configure_theming(env: dict) -> None:
    """Apply Homelab brand (name, colors, logo) to Nextcloud Theming."""
    if not wait_for(_nextcloud_ready, timeout=120, interval=5):
        warn("Nextcloud not ready; skip theming")
        return

    dash = (
        f"{env.get('DASHBOARD_SERVICE_NAME', 'dashboard')}."
        f"{env.get('HOMELAB_HOSTNAME')}"
    )
    _occ("theming:config", "name", "Homelab", check=False)
    _occ("theming:config", "slogan", "Your personal cloud", check=False)
    _occ("theming:config", "url", f"https://{dash}", check=False)
    _occ("theming:config", "primary_color", "#60a5fa", check=False)
    _occ("theming:config", "background_color", "#0f172a", check=False)
    # Solid dark login background (no default scenic photo).
    _occ("theming:config", "background", "backgroundColor", check=False)

    logo_host = Path("./services/gotify/homelab-icon.png")
    logo_svg = Path("./services/dashboard/frontend/public/homelab-icon.svg")
    logo = logo_host if logo_host.is_file() else logo_svg
    if logo.is_file():
        dest = f"/tmp/homelab-theming{logo.suffix}"
        if run_cmd(f"docker cp {logo} nextcloud:{dest}", check=False) is not None:
            _occ("theming:config", "logo", dest, check=False)
            _occ("theming:config", "favicon", dest, check=False)
            _occ("theming:config", "logoheader", dest, check=False)
        else:
            warn("Could not copy logo into Nextcloud for theming")
    else:
        warn("No Homelab logo found for Nextcloud theming")


def _ensure_default_quota(env: dict) -> None:
    """Hard default per-user quota; Authentik/Nextcloud admins stay unlimited."""
    gb = str(env.get("HOMELAB_DEFAULT_QUOTA_GB") or "50").strip() or "50"
    value = f"{gb} GB"
    out = _occ(
        "config:app:set",
        "files",
        "default_quota",
        f"--value={value}",
        check=False,
    ) or ""
    if "error" in out.lower():
        warn(f"files default_quota failed: {out[:200]}")
        return

    listing = _occ("user:list", "--output=json", check=False) or "{}"
    try:
        users = json.loads(listing)
    except Exception:
        users = {}
    if not isinstance(users, dict):
        return

    # uid → display name from occ user:list
    admin_uids: set[str] = {"admin"}
    groups_raw = _occ("group:list", "--output=json", check=False) or "{}"
    try:
        groups = json.loads(groups_raw)
    except Exception:
        groups = {}
    if isinstance(groups, dict):
        for uid in groups.get("admin") or []:
            admin_uids.add(str(uid))

    ak_admins = {n.lower() for n in authentik_group_usernames("homelab-admins")}
    homelab_user = (env.get("HOMELAB_USERNAME") or "").strip().lower()
    if homelab_user:
        ak_admins.add(homelab_user)
    host = (env.get("HOMELAB_HOSTNAME") or "").strip().lower()

    for uid, display in users.items():
        markers = {str(uid).lower(), str(display or "").lower()}
        info_raw = _occ("user:info", uid, "--output=json", check=False) or ""
        try:
            uinfo = json.loads(info_raw)
        except Exception:
            uinfo = {}
        if isinstance(uinfo, dict):
            email = str(uinfo.get("email") or "").lower()
            if email:
                markers.add(email)
                markers.add(email.split("@", 1)[0])
            for g in uinfo.get("groups") or []:
                if str(g).lower() == "admin":
                    admin_uids.add(uid)
        if host and homelab_user and f"{homelab_user}@{host}" in markers:
            markers.add(homelab_user)
        if markers & ak_admins:
            _occ("group:adduser", "admin", uid, check=False)
            admin_uids.add(uid)

    limited = 0
    unlimited = 0
    for uid in users:
        if uid in admin_uids:
            _occ("user:setting", uid, "files", "quota", "none", check=False)
            unlimited += 1
        else:
            _occ("user:setting", uid, "files", "quota", value, check=False)
            limited += 1


def _ensure_local_admin() -> None:
    """Ensure break-glass local user ``admin`` matches nextcloud_admin_password."""
    pw_path = Path("./volumes/secrets/nextcloud_admin_password")
    if not pw_path.is_file():
        warn("nextcloud_admin_password missing; skip local admin sync")
        return
    password = pw_path.read_text(encoding="utf-8").strip()
    users = _occ("user:list", "--output=json", check=False) or ""
    try:
        have_admin = "admin" in json.loads(users)
    except Exception:
        have_admin = "admin" in users
    if not have_admin:
        run_cmd(
            "docker exec -u www-data -e "
            + __import__("shlex").quote(f"OC_PASS={password}")
            + " nextcloud php occ user:add --password-from-env "
            "--display-name=Admin --group=admin admin",
            check=False,
        )
    import subprocess

    subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "-u",
            "www-data",
            "nextcloud",
            "php",
            "occ",
            "user:resetpassword",
            "admin",
        ],
        input=f"{password}\n{password}\n",
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )


def _disable_skeleton() -> None:
    """Skip copying core/skeleton example files into new user homes."""
    out = _occ(
        "config:system:set",
        "skeletondirectory",
        "--value=",
        check=False,
    ) or ""
    if "error" in out.lower():
        warn(f"skeletondirectory disable failed: {out[:200]}")


def _disable_photos_app() -> None:
    """Immich owns photos; keep Nextcloud Photos out of the app launcher."""
    if not _app_enabled("photos"):
        return
    out = _occ("app:disable", "photos", check=False) or ""
    if _app_enabled("photos"):
        warn(f"Could not disable photos app: {out[:200]}")


class NextcloudService(Service):
    name = "nextcloud"
    volume_dirs = [
        VolumeDir("./services/nextcloud/volumes/html", uid=33, gid=33, mode=0o755),
        VolumeDir("./services/nextcloud/volumes/data", uid=33, gid=33, mode=0o750),
        VolumeDir("./services/nextcloud/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./services/nextcloud/volumes/db-dumps", mode=0o700),
        VolumeDir("./services/nextcloud/volumes/redis", uid=999, gid=999, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("nextcloud_db_password", 32)
        gen_secret("nextcloud_oidc_secret", 32)
        gen_secret("nextcloud_admin_password", 32)
        gen_secret("collabora_admin_password", 24)
        if not env.get("HOMELAB_DEFAULT_QUOTA_GB"):
            append_env(env, "HOMELAB_DEFAULT_QUOTA_GB", "50")
        if not env.get("NEXTCLOUD_SERVICE_NAME"):
            append_env(env, "NEXTCLOUD_SERVICE_NAME", "cloud")
        if not env.get("COLLABORA_SERVICE_NAME"):
            append_env(env, "COLLABORA_SERVICE_NAME", "office")

    def postsetup(self, env: dict) -> None:
        try:
            if wait_for(_nextcloud_ready, timeout=120, interval=5):
                _ensure_local_admin()
                _disable_skeleton()
                _disable_photos_app()
        except Exception as exc:
            warn(f"Local admin / skeleton / photos sync failed: {exc}")
        try:
            _configure_theming(env)
        except Exception as exc:
            warn(f"Theming auto-configure failed: {exc}")
        try:
            _ensure_oidc(env)
        except Exception as exc:
            warn(f"OIDC auto-configure failed: {exc}")
        try:
            # After OIDC so existing IdP users are present for admin matching.
            _ensure_default_quota(env)
        except Exception as exc:
            warn(f"Quota sync failed: {exc}")
        try:
            _ensure_groupware_apps(env)
            _ensure_homelab_mail_account(env)
        except Exception as exc:
            warn(f"Calendar/Contacts/Tasks/Mail auto-enable failed: {exc}")
        try:
            _configure_richdocuments(env)
        except Exception as exc:
            warn(f"Collabora auto-configure failed: {exc}")
            office = f"{env.get('COLLABORA_SERVICE_NAME', 'office')}.{env.get('HOMELAB_HOSTNAME')}"
            warn(
                f"Manual: occ app:install richdocuments; "
                f"wopi_url=http://collabora:9980 public_wopi_url=https://{office}"
            )
        try:
            _ensure_smb_external(env)
        except Exception as exc:
            warn(f"SMB external storage failed: {exc}")

    def backup(self, env: dict) -> None:
        # Live Postgres dir is restic-excluded; dump into db-dumps for upload.
        dest = "./services/nextcloud/volumes/db-dumps/nextcloud-backup.sql"
        pg_dump_to_file(
            "nextcloud-db",
            "nextcloud",
            "nextcloud",
            dest,
            password_file="/run/secrets/nextcloud_db_password",
        )

    def restore(self, env: dict) -> None:
        dump = latest_file("./services/nextcloud/volumes/db-dumps", ".sql")
        if dump:
            pg_restore_from_file(
                "nextcloud-db",
                "nextcloud",
                "nextcloud",
                dump,
                password_file="/run/secrets/nextcloud_db_password",
            )


service = NextcloudService()
