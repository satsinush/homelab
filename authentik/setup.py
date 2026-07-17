"""Authentik service — volumes, Postgres dump/restore."""
from __future__ import annotations

from datetime import datetime, timezone

from setup.service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import ok, section
from setup.utils import gen_secret


class AuthentikService(Service):
    name = "authentik"
    volume_dirs = [
        VolumeDir("./authentik/volumes/media", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public", uid=1000, gid=1000, mode=0o755),
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
        ok("Authentik volume directories ready")

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
