"""Authentik service — volumes, secrets, LDAP outpost token sync."""
from __future__ import annotations

import subprocess
from pathlib import Path

from setup.service import (
    Service,
    VolumeDir,
    copy_into_volume,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import ok, warn
from setup.utils import gen_secret, run_cmd

_ICON_SRC = Path("./services/dashboard/frontend/public/homelab-icon.svg")
_ICONS_SRC = Path("./services/dashboard/frontend/src/assets")
_MEDIA_PUBLIC = Path("./services/authentik/volumes/media/public")
_AUTHENTIK_UID = 1000
_AUTHENTIK_GID = 1000
_ENSURE_BP = Path("./services/authentik/scripts/ensure_homelab_blueprint.py")
_HEAL_LDAP = Path("./services/authentik/scripts/sync_ldap_outpost_token.py")


def sync_authentik_branding_assets() -> None:
    """Copy branding icons into the media volume (Authentik UID 1000)."""
    dest_public = _MEDIA_PUBLIC
    dest_icons = dest_public / "icons"

    if _ICON_SRC.is_file():
        copy_into_volume(
            str(_ICON_SRC),
            str(dest_public / "homelab-icon.svg"),
            uid=_AUTHENTIK_UID,
            gid=_AUTHENTIK_GID,
        )
    else:
        warn(f"Missing branding icon: {_ICON_SRC}")

    if _ICONS_SRC.is_dir():
        for src in _ICONS_SRC.iterdir():
            if src.is_file():
                copy_into_volume(
                    str(src),
                    str(dest_icons / src.name),
                    uid=_AUTHENTIK_UID,
                    gid=_AUTHENTIK_GID,
                )
    else:
        warn(f"Missing icons directory: {_ICONS_SRC}")


def _ak_shell_script(script: Path) -> str:
    """Run a Python snippet inside authentik-worker via `ak shell`; return stdout+stderr."""
    res = subprocess.run(
        ["docker", "exec", "-i", "authentik-worker", "ak", "shell"],
        input=script.read_text(encoding="utf-8"),
        text=True,
        capture_output=True,
        check=False,
    )
    return "\n".join(
        line
        for line in ((res.stdout or "") + "\n" + (res.stderr or "")).splitlines()
        if line.strip() and not line.lstrip().startswith("{")
    )


def _blueprint_status() -> str:
    """Return status token from ensure_homelab_blueprint.py (or empty on failure)."""
    if not _ENSURE_BP.is_file():
        return ""
    out = _ak_shell_script(_ENSURE_BP)
    for token in ("blueprint-ok", "blueprint-missing"):
        if token in out:
            return token
    for line in out.splitlines():
        if line.startswith("blueprint-error:"):
            return line.strip()
    return ""


def _apply_homelab_blueprint() -> bool:
    """Apply Homelab Bootstrap once via Authentik CLI. Return True on exit 0."""
    res = subprocess.run(
        [
            "docker",
            "exec",
            "authentik-worker",
            "ak",
            "apply_blueprint",
            "/blueprints/custom/homelab.yaml",
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    combined = (res.stdout or "") + "\n" + (res.stderr or "")
    if res.returncode == 0:
        return True
    # Surface the real serializer/KeyOf error, not the noisy JSON boot logs.
    for line in combined.splitlines():
        low = line.lower()
        if any(
            k in low
            for k in (
                "serializer errors",
                "entry invalid",
                "keyof:",
                "blueprint invalid",
                "required",
            )
        ):
            warn(line.strip()[:300])
    return False


def _ensure_homelab_blueprint(*, timeout_s: float = 90) -> bool:
    """Wait for discovery, then apply once if needed (no blind N-attempt loop)."""
    import time

    running = run_cmd(
        "docker inspect -f '{{.State.Running}}' authentik-worker",
        check=False,
    )
    if (running or "").strip() != "true":
        warn("authentik-worker not running — cannot ensure Homelab blueprint")
        return False

    if not _ENSURE_BP.is_file():
        warn(f"Missing {_ENSURE_BP}")
        return False

    deadline = time.monotonic() + timeout_s
    status = ""
    while time.monotonic() < deadline:
        status = _blueprint_status()
        if status == "blueprint-ok":
            return True
        if status == "blueprint-missing":
            time.sleep(3)
            continue
        if status.startswith("blueprint-error:"):
            break
        # Worker still booting / shell not ready yet.
        time.sleep(3)

    if status == "blueprint-ok":
        return True

    if status == "blueprint-missing":
        warn("Homelab Bootstrap was never discovered by Authentik")
        return False

    # Discovered but not successful (typical fresh-install race) — apply once.
    if not _apply_homelab_blueprint():
        warn("Homelab Bootstrap apply failed")
        return False

    return True


def _sync_ldap_outpost_token() -> None:
    """Pull LDAP Outpost token into volumes/secrets (host-side; not expressible in YAML).

    Apps/users/OIDC/LDAP provider come from blueprints/homelab.yaml on Authentik startup.
    This only bridges the outpost token into Docker secrets + recreates authentik-ldap.
    """
    if not _HEAL_LDAP.is_file():
        warn(f"Missing {_HEAL_LDAP}")
        return
    out = _ak_shell_script(_HEAL_LDAP)
    token = ""
    for line in out.splitlines():
        if line.startswith("ldap-token:"):
            token = line[len("ldap-token:") :].strip()
            break
    if token and len(token) >= 20:
        path = Path("./volumes/secrets/ldap_outpost_token")
        path.write_text(token + "\n", encoding="utf-8")
        path.chmod(0o600)
        run_cmd(
            "docker compose --env-file .env up -d --force-recreate authentik-ldap",
            check=False,
        )
    else:
        warn(
            "Could not read LDAP Outpost token — open Authentik → Outposts, "
            "copy token into volumes/secrets/ldap_outpost_token, recreate authentik-ldap"
        )


class AuthentikService(Service):
    name = "authentik"
    volume_dirs = [
        VolumeDir("./services/authentik/volumes/media", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./services/authentik/volumes/media/public", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./services/authentik/volumes/media/public/icons", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./services/authentik/volumes/templates", mode=0o755),
        VolumeDir("./services/authentik/volumes/certs", mode=0o755),
        VolumeDir("./services/authentik/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./services/authentik/volumes/db-dumps", mode=0o700),
        VolumeDir("./services/authentik/volumes/redis", uid=999, gid=999, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("authentik_secret_key", 50)
        gen_secret("authentik_pg_pass", 32)
        gen_secret("authentik_akadmin_password", 32)
        gen_secret("ldap_service_password", 32)
        # Placeholder until postsetup copies the real Outpost token from Authentik.
        gen_secret("ldap_outpost_token", 40)
        gen_secret("nextcloud_oidc_secret", 32)
        gen_secret("immich_oidc_secret", 32)
        gen_secret("host_api_token", 32)
        sync_authentik_branding_assets()

    def postsetup(self, env: dict) -> None:
        """Host-only follow-up after Authentik has applied its blueprints."""
        try:
            if not _ensure_homelab_blueprint():
                warn("Skipping LDAP outpost token sync — Homelab blueprint not ready")
                return
            ok("Homelab Bootstrap blueprint applied")
            _sync_ldap_outpost_token()
        except Exception as exc:
            warn(f"LDAP outpost token sync failed: {exc}")

    def backup(self, env: dict) -> None:
        dest = "./services/authentik/volumes/db-dumps/authentik-backup.sql"
        user = env.get("AUTHENTIK_PG_USER", "authentik")
        db = env.get("AUTHENTIK_PG_DB", "authentik")
        pg_dump_to_file(
            "authentik-postgres",
            db,
            user,
            dest,
            password_file="/run/secrets/authentik_pg_pass",
        )

    def restore(self, env: dict) -> None:
        dump = latest_file("./services/authentik/volumes/db-dumps", ".sql")
        if dump:
            user = env.get("AUTHENTIK_PG_USER", "authentik")
            db = env.get("AUTHENTIK_PG_DB", "authentik")
            pg_restore_from_file(
                "authentik-postgres",
                db,
                user,
                dump,
                password_file="/run/secrets/authentik_pg_pass",
            )


service = AuthentikService()
