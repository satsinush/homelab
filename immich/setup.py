"""Immich service — persistent volumes and database/OIDC secrets."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import info, ok, section
from setup.utils import gen_secret


class ImmichService(Service):
    name = "immich"
    volume_dirs = [
        VolumeDir("./immich/volumes/upload", mode=0o755),
        VolumeDir("./immich/volumes/model-cache", mode=0o755),
        VolumeDir("./immich/volumes/db", uid=999, gid=999, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Immich secrets...", emoji="📷")
        gen_secret("immich_db_password", 32)
        gen_secret("immich_oidc_secret", 32)
        from pathlib import Path

        from setup.utils import append_env

        pw = Path("./volumes/secrets/immich_db_password").read_text(encoding="utf-8").strip()
        oidc = Path("./volumes/secrets/immich_oidc_secret").read_text(encoding="utf-8").strip()
        append_env(env, "IMMICH_DB_PASSWORD", pw)
        append_env(env, "IMMICH_OIDC_SECRET", oidc)
        if not env.get("IMMICH_SERVICE_NAME"):
            append_env(env, "IMMICH_SERVICE_NAME", "photos")
        ok("Immich database and OIDC secrets ready")
    def postsetup(self, env: dict) -> None:
        info(
            "Configure OpenID Connect in Immich's Administration settings using "
            "the Authentik endpoints and immich_oidc_secret."
        )


service = ImmichService()
