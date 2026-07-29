"""Gotify service — data volume, admin + alerts passwords, SQLite snapshot/restore."""
from __future__ import annotations

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.utils import gen_secret

# Shared login for phone clients / family — owns per-service Gotify apps.
GOTIFY_ALERTS_USERNAME = "alerts"


class GotifyService(Service):
    name = "gotify"
    volume_dirs = [
        VolumeDir("./services/gotify/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("gotify_admin_password", 32)
        gen_secret("gotify_alerts_password", 32)

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "gotify",
            "/app/data/gotify.db",
            "/app/data/gotify_snapshot.db",
            host_bind="./services/gotify/volumes/data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "gotify",
            "/app/data/gotify.db",
            "./services/gotify/volumes/data/gotify_snapshot.db",
            "./services/gotify/volumes/data",
        )


service = GotifyService()
