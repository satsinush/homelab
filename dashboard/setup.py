"""Homelab Dashboard service — API/word-games volumes + SQLite snapshot."""
from __future__ import annotations

from service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup_utils import gen_secret


class DashboardService(Service):
    name = "dashboard"
    volume_dirs = [
        VolumeDir("./dashboard/volumes/api-data", uid=0, gid=0, mode=0o755),
        VolumeDir("./dashboard/volumes/word-games-data", uid=0, gid=0, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🏠 Preparing Homelab Dashboard secrets...")
        gen_secret("homelab_api_session_secret", 64)
        gen_secret("dashboard_oidc_secret", 64)
        print("   ✅ Dashboard secrets ready")

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
