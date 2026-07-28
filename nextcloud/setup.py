"""Nextcloud + Collabora — volumes, secrets, richdocuments wiring."""
from __future__ import annotations

import json
from pathlib import Path

from setup.service import Service, VolumeDir
from setup.ui import info, ok, section, warn
from setup.utils import append_env, docker_exec, gen_secret, run_cmd, wait_for


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
    info(f"Installing {app_id} from GitHub ({url.rsplit('/', 1)[-1]})…")
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
    info(f"Installing {app_id}…")
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


def _ensure_groupware_apps(env: dict) -> None:
    section("Enabling Nextcloud Calendar, Contacts & Mail...", emoji="📅")
    if not wait_for(_nextcloud_ready, timeout=120, interval=5):
        warn("Nextcloud not ready; skip calendar/contacts/mail")
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
    mail_ok = _ensure_app(
        "mail",
        "https://github.com/nextcloud-releases/mail/releases/download/"
        "v5.10.9/mail-v5.10.9.tar.gz",
    )
    if cal_ok and contacts_ok:
        ok("Calendar and Contacts enabled")
    else:
        if not cal_ok:
            warn("Could not enable calendar")
        if not contacts_ok:
            warn("Could not enable contacts")
    if mail_ok:
        _configure_mail_for_stalwart(env)
    else:
        warn("Could not enable mail")


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
    ok(f"Nextcloud Mail ready for Stalwart ({mail_host}:993 / :465)")
    info(
        f"Mailbox login is your Authentik email ({domain}) and Authentik password. "
        "To change the stored Mail password later: Mail → account menu (⋯) → "
        "Account settings → Password."
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
        info(
            f"No Nextcloud user for {username} yet; open Mail after first login "
            "to add the account"
        )
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
        if "updated" in out.lower() or "error" not in out.lower():
            ok(f"Nextcloud Mail account refreshed for {email} → {mail_host}")
        else:
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
    else:
        ok(f"Nextcloud Mail account ready for {email}")


def _ensure_oidc(env: dict) -> None:
    """Install user_oidc and point it at Authentik (auto-provision on first login)."""
    section("Configuring Nextcloud OIDC (Authentik)...", emoji="🔑")
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

    # unique-uid=0 → use preferred_username / sub mapping from IdP (not a hashed uid).
    # endsession + id_token_hint required for logout (/apps/user_oidc/sls) to work.
    out = _occ(
        "user_oidc:provider",
        "Authentik",
        "--clientid=nextcloud",
        f"--clientsecret={secret}",
        f"--discoveryuri={discovery}",
        f"--endsessionendpointuri={end_session}",
        f"--postlogouturi={post_logout}",
        "--send-id-token-hint=1",
        "--scope=openid profile email",
        "--unique-uid=0",
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
    else:
        ok(f"Nextcloud OIDC → {discovery}")
        info(
            f"Normal login redirects to Authentik; break-glass admin "
            f"(admin / nextcloud_admin_password): https://{cloud}/login?direct=1"
        )


def _configure_richdocuments(env: dict) -> None:
    """Install Nextcloud Office and point it at Collabora (idempotent)."""
    cloud = f"{env.get('NEXTCLOUD_SERVICE_NAME', 'cloud')}.{env.get('HOMELAB_HOSTNAME')}"
    office = f"{env.get('COLLABORA_SERVICE_NAME', 'office')}.{env.get('HOMELAB_HOSTNAME')}"
    public_wopi = f"https://{office}"
    # Server-side discovery over the Docker network (no Traefik/TLS needed).
    internal_wopi = "http://collabora:9980"

    section("Configuring Nextcloud Office (Collabora)...", emoji="📄")

    if not wait_for(_nextcloud_ready, timeout=180, interval=5):
        warn("Nextcloud not ready; skip Collabora wiring")
        return

    if not wait_for(
        lambda: "healthy"
        in (
            run_cmd(
                'docker inspect -f "{{.State.Health.Status}}" collabora 2>/dev/null',
                check=False,
            )
            or ""
        ),
        timeout=180,
        interval=5,
    ):
        warn("Collabora not healthy; skip Collabora wiring")
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
    if "error" in activate.lower() and "configured" not in activate.lower():
        warn(f"richdocuments:activate-config: {activate[:400]}")
    else:
        ok(f"Nextcloud Office → Collabora ({internal_wopi}, public {public_wopi})")
        info(f"Create/open .odt/.ods/.odp from https://{cloud}")


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
    ok("Nextcloud local admin user synced (admin / nextcloud_admin_password)")


class NextcloudService(Service):
    name = "nextcloud"
    volume_dirs = [
        VolumeDir("./nextcloud/volumes/html", uid=33, gid=33, mode=0o755),
        VolumeDir("./nextcloud/volumes/data", uid=33, gid=33, mode=0o750),
        VolumeDir("./nextcloud/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./nextcloud/volumes/redis", uid=999, gid=999, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Nextcloud + Collabora secrets...", emoji="☁️")
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
        # Collabora compose reads COLLABORA_ADMIN_PASSWORD from .env
        pw = Path("./volumes/secrets/collabora_admin_password").read_text(encoding="utf-8").strip()
        append_env(env, "COLLABORA_ADMIN_PASSWORD", pw)
        ok("Nextcloud + Collabora secrets ready")

    def postsetup(self, env: dict) -> None:
        cloud = f"{env.get('NEXTCLOUD_SERVICE_NAME', 'cloud')}.{env.get('HOMELAB_HOSTNAME')}"
        info(
            f"Default quota: {env.get('HOMELAB_DEFAULT_QUOTA_GB', '50')} GB — "
            "OIDC auto-provisions HOMELAB_USERNAME on first Authentik login."
        )
        info(
            f"Break-glass local admin: user=admin, "
            f"secret=volumes/secrets/nextcloud_admin_password → https://{cloud}/login?direct=1"
        )
        try:
            if wait_for(_nextcloud_ready, timeout=120, interval=5):
                _ensure_local_admin()
        except Exception as exc:
            warn(f"Local admin sync failed: {exc}")
        try:
            _ensure_oidc(env)
        except Exception as exc:
            warn(f"OIDC auto-configure failed: {exc}")
        try:
            _ensure_groupware_apps(env)
            _ensure_homelab_mail_account(env)
        except Exception as exc:
            warn(f"Calendar/Contacts/Mail auto-enable failed: {exc}")
        try:
            _configure_richdocuments(env)
        except Exception as exc:
            warn(f"Collabora auto-configure failed: {exc}")
            office = f"{env.get('COLLABORA_SERVICE_NAME', 'office')}.{env.get('HOMELAB_HOSTNAME')}"
            warn(
                f"Manual: occ app:install richdocuments; "
                f"wopi_url=http://collabora:9980 public_wopi_url=https://{office}"
            )
            warn(f"Cloud: https://{cloud}")


service = NextcloudService()
