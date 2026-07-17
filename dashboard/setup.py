"""Homelab Dashboard service — API/word-games volumes + SQLite snapshot."""
from __future__ import annotations

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.ui import ok, section
from setup.utils import gen_secret


class DashboardService(Service):
    name = "dashboard"
    volume_dirs = [
        VolumeDir("./dashboard/volumes/api-data", mode=0o755),
        VolumeDir("./dashboard/volumes/word-games-data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Homelab Dashboard secrets...", emoji="🏠")
        gen_secret("homelab_api_session_secret", 64)
        gen_secret("dashboard_oidc_secret", 64)
        ok("Dashboard secrets ready")

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "dashboard",
            "/app/api/data/homelab.db",
            "/app/api/data/homelab_snapshot.db",
            host_bind="./dashboard/volumes/api-data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "dashboard",
            "/app/api/data/homelab.db",
            "./dashboard/volumes/api-data/homelab_snapshot.db",
            "./dashboard/volumes/api-data",
        )


service = DashboardService()
