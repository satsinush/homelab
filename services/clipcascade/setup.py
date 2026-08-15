"""ClipCascade service — database volume, SQLite snapshot/restore."""
from __future__ import annotations

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot


class ClipcascadeService(Service):
    name = "clipcascade"
    volume_dirs = [
        VolumeDir("./services/clipcascade/volumes/database", mode=0o700),
    ]

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "clipcascade",
            "/database/users.db",
            "/database/users_snapshot.db",
            host_bind="./services/clipcascade/volumes/database",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "clipcascade",
            "/database/users.db",
            "./services/clipcascade/volumes/database/users_snapshot.db",
            "./services/clipcascade/volumes/database",
        )


service = ClipcascadeService()
