"""Post-start setup for Nextcloud: OIDC, theming, cron, and security hardening."""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from setup_utils import detect_homelab_locale, gen_secret, phone_region_from_tz, run_cmd

_EXPENSIVE_REPAIR_MARKER = "./nextcloud/volumes/.expensive-repair-done"


def _read_secret(name: str) -> str:
    path = f"./volumes/secrets/{name}"
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def _occ(*args: str, check: bool = True) -> str | None:
    cmd = ["docker", "exec", "-u", "www-data", "nextcloud", "php", "occ", *args]
    try:
        res = subprocess.run(cmd, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return (res.stdout or "").strip()
    except subprocess.CalledProcessError as e:
        print(f"   ⚠️  occ {' '.join(args[:3])}... failed: {(e.stderr or e.stdout or '').strip()[:400]}")
        if check:
            raise
        return None


def _maintenance_window_utc_hour(tz_name: str, local_hour: int = 1) -> int:
    """UTC hour for daily heavy jobs, targeting `local_hour`:00 in TZ (default 1 AM local)."""
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        print(f"   ⚠️  Unknown TZ {tz_name!r}; using UTC hour {local_hour}")
        return local_hour

    now = datetime.now(tz)
    local_at = now.replace(hour=local_hour, minute=0, second=0, microsecond=0)
    return local_at.astimezone(timezone.utc).hour


def _wait_for_nextcloud(attempts: int = 60) -> bool:
    print("   Waiting for Nextcloud...")
    for _ in range(attempts):
        status = run_cmd(
            "docker inspect -f '{{.State.Health.Status}}' nextcloud 2>/dev/null",
            check=False,
        )
        if status == "healthy":
            return True
        out = _occ("status", check=False) or ""
        if "installed: true" in out:
            return True
        time.sleep(5)
    return False


def _ensure_theming(env: dict) -> None:
    """Match Homelab dashboard branding (name, URL, dark-theme colors, logo)."""
    service = env.get("NEXTCLOUD_SERVICE_NAME", "nextcloud")
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    base_url = f"https://{service}.{hostname}"

    # Dashboard ThemeContext dark palette
    primary = "#60a5fa"
    background = "#0f172a"

    print("   Applying Homelab theming...")
    _occ("theming:config", "name", "Homelab", check=False)
    _occ("theming:config", "url", base_url, check=False)
    _occ("theming:config", "slogan", "Self-hosted files for your homelab", check=False)
    _occ("theming:config", "primary_color", primary, check=False)
    # Older Nextcloud used "color"; set both for compatibility
    _occ("theming:config", "color", primary, check=False)
    _occ("theming:config", "background_color", background, check=False)
    _occ("theming:config", "background", "backgroundColor", check=False)
    _occ("theming:config", "--reset", "imprintUrl", check=False)
    _occ("theming:config", "--reset", "privacyUrl", check=False)

    # Prefer Homelab icon; fall back to Nextcloud asset if SVG rejected
    logo = _occ("theming:config", "logo", "/mnt/homelab-branding/logo.svg", check=False)
    if logo is None:
        _occ("theming:config", "logo", "/mnt/homelab-branding/nextcloud_logo.png", check=False)
    _occ("theming:config", "logoheader", "/mnt/homelab-branding/logo.svg", check=False)
    # favicon.ico in the dashboard public tree is a stub; reuse the SVG icon
    fav = _occ("theming:config", "favicon", "/mnt/homelab-branding/logo.svg", check=False)
    if fav is None:
        _occ("theming:config", "favicon", "/mnt/homelab-branding/nextcloud_logo.png", check=False)

    # Default landing after login
    _occ("config:system:set", "defaultapp", "--value=dashboard", check=False)

    print(f"   ✅ Theming: Homelab @ {base_url} ({primary} on {background})")


def _ensure_cron() -> None:
    """Use system cron (via nextcloud-cron sidecar) for background jobs."""
    print("   Enabling Cron background jobs...")
    _occ("background:cron", check=False)
    run_cmd("docker compose up -d nextcloud-cron", check=False)
    print("   ✅ Background jobs set to Cron (nextcloud-cron runs every 5 minutes)")


def _resolve_locale(env: dict, phone_region: str) -> tuple[str, str]:
    """Prefer HOMELAB_* from setup.py; otherwise detect from host / TZ region."""
    language = (env.get("HOMELAB_LANGUAGE") or os.environ.get("HOMELAB_LANGUAGE") or "").strip()
    locale = (env.get("HOMELAB_LOCALE") or os.environ.get("HOMELAB_LOCALE") or "").strip()
    if language and locale:
        return language, locale
    tz_name = env.get("TZ") or os.environ.get("TZ") or "UTC"
    detected_lang, detected_locale = detect_homelab_locale(tz_name, region=phone_region)
    return language or detected_lang, locale or detected_locale


def _ensure_locale(env: dict, phone_region: str) -> tuple[str, str]:
    """Set system defaults + admin user language/locale (weather °F needs en_US, etc.)."""
    language, locale = _resolve_locale(env, phone_region)
    print(f"   Locale defaults → language={language}, locale={locale}...")
    _occ("config:system:set", "default_language", f"--value={language}", check=False)
    _occ("config:system:set", "default_locale", f"--value={locale}", check=False)

    username = (env.get("HOMELAB_USERNAME") or os.environ.get("HOMELAB_USERNAME") or "").strip()
    if username:
        _occ("user:setting", username, "core", "lang", language, check=False)
        _occ("user:setting", username, "core", "locale", locale, check=False)
        print(f"   ✅ User {username}: lang={language}, locale={locale}")
    return language, locale


def _ensure_hardening(env: dict) -> None:
    """Apply recommended setup checks; skip NC 2FA (MFA belongs in Authentik)."""
    tz_name = env.get("TZ") or os.environ.get("TZ") or "UTC"
    phone_region = phone_region_from_tz(tz_name)
    language, locale = _ensure_locale(env, phone_region)
    maint_hour = _maintenance_window_utc_hour(tz_name, local_hour=1)

    print(
        f"   Hardening from TZ={tz_name} → phone={phone_region}, "
        f"locale={locale}, maintenance UTC hour={maint_hour}..."
    )
    _occ(
        "config:system:set",
        "default_phone_region",
        "--value=" + phone_region,
        check=False,
    )
    _occ(
        "config:system:set",
        "maintenance_window_start",
        "--type=integer",
        f"--value={maint_hour}",
        check=False,
    )

    # Single-container stack: serverid only matters for multi-PHP farms, but
    # setting 0 clears the overview warning (valid range 0–511).
    _occ(
        "config:system:set",
        "serverid",
        "--type=integer",
        "--value=0",
        check=False,
    )

    # Ex-Apps need a deploy daemon; not used in this stack — disable the warning source
    _occ("app:disable", "app_api", check=False)

    # Updater cleanup expects this path even when using Docker image updates
    _ensure_updater_backup_dir()

    # One-time expensive mimetype migrations
    os.makedirs("./nextcloud/volumes", exist_ok=True)
    if not os.path.exists(_EXPENSIVE_REPAIR_MARKER):
        print("   Running expensive maintenance repair (mimetypes); first run only...")
        _occ("maintenance:repair", "--include-expensive", check=False)
        with open(_EXPENSIVE_REPAIR_MARKER, "w", encoding="utf-8") as f:
            f.write(datetime.now(timezone.utc).isoformat() + "\n")
        print("   ✅ Expensive repair complete")
    else:
        print("   ℹ️  Expensive repair already done (marker present)")

    print(
        f"   ✅ Hardening applied (phone={phone_region}, locale={locale}/{language}, "
        f"maintenance_window_start={maint_hour} UTC ≈ 01:00 {tz_name})"
    )
    print("   ℹ️  2FA enforcement skipped — use Authentik MFA instead")


def _ensure_updater_backup_dir() -> None:
    """Avoid updater backup clean-up warnings when the folder was never created."""
    instance_id = _occ("config:system:get", "instanceid", check=False)
    if not instance_id:
        return
    path = f"/var/www/html/data/updater-{instance_id}/backups"
    run_cmd(
        f"docker exec -u www-data nextcloud mkdir -p {path}",
        check=False,
    )
    print(f"   ✅ Ensured updater backups dir ({path})")


def _wait_for_collabora(attempts: int = 36) -> bool:
    print("   Waiting for Collabora...")
    for _ in range(attempts):
        status = run_cmd(
            "docker inspect -f '{{.State.Health.Status}}' collabora 2>/dev/null",
            check=False,
        )
        if status == "healthy":
            return True
        # Collabora image has no curl; probe discovery via Nextcloud container
        ok = run_cmd(
            "docker exec nextcloud curl -fsS http://collabora:9980/hosting/discovery 2>/dev/null | grep -qi wopi-discovery && echo ok",
            check=False,
        )
        if ok == "ok":
            return True
        time.sleep(5)
    return False


def _ensure_collabora_ca_bundle() -> None:
    """Merge Homelab CA into Collabora's trust store for WOPI SSL verification."""
    ca = Path("./volumes/certificates/homelab-ca.crt")
    bundle = Path("./volumes/certificates/collabora-ca-bundle.crt")
    if not ca.is_file():
        print("   ⚠️  Homelab CA missing; Collabora SSL verification may fail")
        return
    # Rebuild when missing or Homelab CA is newer than the bundle
    if bundle.is_file() and bundle.stat().st_mtime >= ca.stat().st_mtime:
        return
    print("   Building Collabora CA bundle (system CAs + Homelab root)...")
    bundle.parent.mkdir(parents=True, exist_ok=True)
    run_cmd(
        "docker run --rm --entrypoint cat collabora/code:latest "
        f"/etc/ssl/certs/ca-certificates.crt > {bundle} "
        f"&& cat {ca} >> {bundle}",
        check=False,
    )
    if not bundle.is_file() or bundle.stat().st_size < 1000:
        bundle.write_bytes(ca.read_bytes())
    print(f"   ✅ Wrote {bundle} ({bundle.stat().st_size} bytes)")


def _ensure_collabora(env: dict) -> None:
    """Install Nextcloud Office (richdocuments) and point it at Collabora CODE."""
    service = env.get("NEXTCLOUD_SERVICE_NAME", "nextcloud")
    collabora = env.get("COLLABORA_SERVICE_NAME", "collabora")
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    # NC → Collabora on the Docker network; browser → Collabora public hostname
    wopi_internal = "http://collabora:9980"
    wopi_public = f"https://{collabora}.{hostname}"

    gen_secret("collabora_admin_password", 24)
    _ensure_collabora_ca_bundle()
    run_cmd("docker compose up -d collabora", check=False)

    if not _wait_for_collabora():
        print("   ⚠️  Collabora did not become ready; skipping Office app config")
        return

    apps = _occ("app:list", check=False) or ""
    if "richdocuments" not in apps:
        print("   Installing richdocuments (Nextcloud Office)...")
        _occ("app:install", "richdocuments", check=False)
    _occ("app:enable", "richdocuments", check=False)

    print(f"   Configuring Collabora (internal={wopi_internal}, public={wopi_public})...")
    _occ("config:app:set", "richdocuments", "wopi_url", f"--value={wopi_internal}", check=False)
    _occ("config:app:set", "richdocuments", "public_wopi_url", f"--value={wopi_public}", check=False)
    _occ(
        "config:app:set",
        "richdocuments",
        "disable_certificate_verification",
        "--value=yes",
        check=False,
    )
    _occ("richdocuments:activate-config", check=False)

    print(f"   ✅ Nextcloud Office ready via Collabora ({wopi_public})")
    print(f"   ℹ️  Visit {wopi_public} once in your browser if prompted to trust the Homelab cert")
    print(f"   ℹ️  Open .odt/.ods/.odp (and Office) files from https://{service}.{hostname}")


def _ensure_user_oidc(env: dict) -> None:
    service = env.get("NEXTCLOUD_SERVICE_NAME", "nextcloud")
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    authentik = env.get("AUTHENTIK_SERVICE_NAME", "authentik")
    oidc_secret = _read_secret("nextcloud_oidc_secret")
    discovery = (
        f"https://{authentik}.{hostname}/application/o/nextcloud/"
        ".well-known/openid-configuration"
    )

    # Trust private Authentik cert when fetching discovery/JWKS
    _occ(
        "config:system:set",
        "user_oidc",
        "httpclient.allowselfsigned",
        "--type=boolean",
        "--value=true",
        check=False,
    )
    _occ(
        "config:system:set",
        "allow_local_remote_servers",
        "--type=boolean",
        "--value=true",
        check=False,
    )

    apps = _occ("app:list", check=False) or ""
    if "user_oidc:" not in apps and "user_oidc\n" not in apps and " - user_oidc:" not in apps:
        # app:list formats vary; also try install when enable fails
        print("   Installing user_oidc...")
        _occ("app:install", "user_oidc", check=False)
    _occ("app:enable", "user_oidc", check=False)

    print("   Configuring Authentik OIDC provider...")
    _occ(
        "user_oidc:provider",
        "authentik",
        "--clientid=nextcloud",
        f"--clientsecret={oidc_secret}",
        f"--discoveryuri={discovery}",
        "--scope=openid email profile nextcloud",
        "--mapping-uid=user_id",
        "--mapping-display-name=name",
        "--mapping-email=email",
        "--mapping-quota=quota",
        "--mapping-groups=groups",
        "--group-provisioning=1",
        "--unique-uid=0",
        check=False,
    )

    _occ(
        "config:app:set",
        "user_oidc",
        "allow_multiple_user_backends",
        "--type=string",
        "--value=0",
        check=False,
    )

    print(f"   ✅ Nextcloud OIDC ready: https://{service}.{hostname}")
    print(f"   ℹ️  Local admin fallback: https://{service}.{hostname}/login?direct=1")
    print("   ℹ️  Admin password: volumes/secrets/nextcloud_admin_password")


def setup(env: dict) -> None:
    print("\n☁️  Setting up Nextcloud...")
    gen_secret("nextcloud_oidc_secret", 64)
    gen_secret("nextcloud_db_password", 32)
    gen_secret("nextcloud_admin_password", 32)
    gen_secret("collabora_admin_password", 24)

    if not shutil.which("docker"):
        print("   ❌ Docker not available; skipping Nextcloud OIDC setup")
        return

    run_cmd(
        "docker compose up -d nextcloud-db nextcloud-redis nextcloud nextcloud-cron collabora",
        check=False,
    )

    if not _wait_for_nextcloud():
        print("   ⚠️  Nextcloud did not become ready; skipping OIDC setup (re-run setup later)")
        return

    _ensure_theming(env)
    _ensure_cron()
    _ensure_hardening(env)
    _ensure_user_oidc(env)
    _ensure_collabora(env)
