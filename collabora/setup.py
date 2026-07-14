"""Collabora service — admin password secret."""
from __future__ import annotations

from service import Service
from setup_utils import gen_secret


class CollaboraService(Service):
    name = "collabora"
    volume_dirs = []

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n📝 Preparing Collabora secrets...")
        gen_secret("collabora_admin_password", 24)
        print("   ✅ Collabora secrets ready")


service = CollaboraService()
