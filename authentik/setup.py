"""Authentik service — volumes, secrets, LDAP outpost token sync."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from setup.service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import info, ok, section, warn
from setup.utils import gen_secret, run_cmd

_ICON_SRC = Path("./dashboard/frontend/public/homelab-icon.svg")
_ICONS_SRC = Path("./dashboard/frontend/src/assets")
_MEDIA_PUBLIC = Path("./authentik/volumes/media/public")
_HEAL_LDAP = Path("./authentik/scripts/sync_ldap_outpost_token.py")


def sync_authentik_branding_assets() -> None:
    """Copy branding icons into the media volume (no nested Docker file mounts)."""
    dest_public = _MEDIA_PUBLIC
    dest_public.mkdir(parents=True, exist_ok=True)
    dest_icons = dest_public / "icons"
    dest_icons.mkdir(parents=True, exist_ok=True)

    if _ICON_SRC.is_file():
        shutil.copy2(_ICON_SRC, dest_public / "homelab-icon.svg")
    else:
        warn(f"Missing branding icon: {_ICON_SRC}")

    if _ICONS_SRC.is_dir():
        for src in _ICONS_SRC.iterdir():
            if src.is_file():
                shutil.copy2(src, dest_icons / src.name)
    else:
        warn(f"Missing icons directory: {_ICONS_SRC}")


def _sync_ldap_outpost_token() -> None:
    """Pull LDAP Outpost token into volumes/secrets (host-side; not expressible in YAML).

    Apps/users/OIDC/LDAP provider come from blueprints/homelab.yaml on Authentik startup.
    This only bridges the outpost token into Docker secrets + recreates authentik-ldap.
    """
    if not _HEAL_LDAP.is_file():
        warn(f"Missing {_HEAL_LDAP}")
        return
    res = subprocess.run(
        ["docker", "exec", "-i", "authentik-worker", "ak", "shell"],
        input=_HEAL_LDAP.read_text(encoding="utf-8"),
        text=True,
        capture_output=True,
        check=False,
    )
    out = "\n".join(
        line
        for line in ((res.stdout or "") + "\n" + (res.stderr or "")).splitlines()
        if line.strip() and not line.lstrip().startswith("{")
    )
    token = ""
    for line in out.splitlines():
        if line.startswith("ldap-token:"):
            token = line[len("ldap-token:") :].strip()
            break
    if "ldap-search-perm-ok" in out:
        ok("LDAP search permission ensured for ldapservice")
    if token and len(token) >= 20:
        path = Path("./volumes/secrets/ldap_outpost_token")
        path.write_text(token + "\n", encoding="utf-8")
        path.chmod(0o600)
        ok("Wrote LDAP outpost token from Authentik")
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
        VolumeDir("./authentik/volumes/media", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public/icons", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/templates", mode=0o755),
        VolumeDir("./authentik/volumes/certs", mode=0o755),
        VolumeDir("./authentik/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./authentik/volumes/db-dumps", mode=0o700),
        VolumeDir("./authentik/volumes/redis", uid=999, gid=999, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Authentik volumes and secrets...", emoji="🔑")
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
        ok("Authentik volume directories ready")
        info(
            "OIDC/LDAP/apps: authentik/blueprints/homelab.yaml "
            "(auto-applied from /blueprints/custom on worker start)"
        )

    def postsetup(self, env: dict) -> None:
        """Host-only follow-up after Authentik has applied its blueprints."""
        section("Syncing Authentik LDAP outpost token...", emoji="🔑")
        info(
            "Homelab Bootstrap blueprint is applied by Authentik itself; "
            "postsetup only syncs the LDAP outpost token for authentik-ldap."
        )
        try:
            _sync_ldap_outpost_token()
        except Exception as exc:
            warn(f"LDAP outpost token sync failed: {exc}")

    def backup(self, env: dict) -> None:
        dest = "./authentik/volumes/db-dumps/authentik-backup.sql"
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
        dump = latest_file("./authentik/volumes/db-dumps", ".sql")
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
