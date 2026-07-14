"""Gotify service — data volume, admin password, SQLite snapshot/restore."""
from __future__ import annotations

from service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup_utils import gen_secret


class GotifyService(Service):
    name = "gotify"
    volume_dirs = [
        VolumeDir("./gotify/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🔔 Preparing Gotify secrets...")
        gen_secret("gotify_admin_password", 32)
        print("   ✅ Gotify secrets ready")

    def backup(self, env: dict) -> None:
        # Gotify stores DB as data/gotify.db by default
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
