"""Nextcloud + Collabora — volumes, secrets, OIDC/Collabora wiring notes."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import info, ok, section
from setup.utils import append_env, gen_secret


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
        gen_secret("collabora_admin_password", 24)
        if not env.get("HOMELAB_DEFAULT_QUOTA_GB"):
            append_env(env, "HOMELAB_DEFAULT_QUOTA_GB", "50")
        if not env.get("NEXTCLOUD_SERVICE_NAME"):
            append_env(env, "NEXTCLOUD_SERVICE_NAME", "cloud")
        if not env.get("COLLABORA_SERVICE_NAME"):
            append_env(env, "COLLABORA_SERVICE_NAME", "office")
        # Collabora compose reads COLLABORA_ADMIN_PASSWORD from .env
        from pathlib import Path

        pw = Path("./volumes/secrets/collabora_admin_password").read_text(encoding="utf-8").strip()
        append_env(env, "COLLABORA_ADMIN_PASSWORD", pw)
        ok("Nextcloud + Collabora secrets ready")

    def postsetup(self, env: dict) -> None:
        cloud = f"{env.get('NEXTCLOUD_SERVICE_NAME', 'cloud')}.{env.get('HOMELAB_HOSTNAME')}"
        office = f"{env.get('COLLABORA_SERVICE_NAME', 'office')}.{env.get('HOMELAB_HOSTNAME')}"
        info(
            "Nextcloud OIDC: install 'OpenID Connect Login', client_id=nextcloud, "
            f"secret=volumes/secrets/nextcloud_oidc_secret, discovery at Authentik."
        )
        info(
            f"Collabora (richdocuments): set WOPI URL to https://{office} "
            f"(Traefik TLS; container talks HTTP to Nextcloud). Cloud: https://{cloud}"
        )
        info(
            f"Default quota: {env.get('HOMELAB_DEFAULT_QUOTA_GB', '50')} GB — "
            "set in Administration → Users or via occ after first login."
        )


service = NextcloudService()
