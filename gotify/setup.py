"""Gotify service — data volume, admin + alerts passwords, SQLite snapshot/restore."""
from __future__ import annotations

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.ui import info, ok, section
from setup.utils import gen_secret

# Shared login for phone clients / family — owns per-service Gotify apps.
GOTIFY_ALERTS_USERNAME = "alerts"


class GotifyService(Service):
    name = "gotify"
    volume_dirs = [
        VolumeDir("./gotify/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Gotify secrets...", emoji="🔔")
        gen_secret("gotify_admin_password", 32)
        gen_secret("gotify_alerts_password", 32)
        ok("Gotify admin + alerts user secrets ready")
        info(
            f"Share Gotify login `{GOTIFY_ALERTS_USERNAME}` "
            "(password in volumes/secrets/gotify_alerts_password)"
        )

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "gotify",
            "/app/data/gotify.db",
            "/app/data/gotify_snapshot.db",
            host_bind="./gotify/volumes/data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "gotify",
            "/app/data/gotify.db",
            "./gotify/volumes/data/gotify_snapshot.db",
            "./gotify/volumes/data",
        )


service = GotifyService()
