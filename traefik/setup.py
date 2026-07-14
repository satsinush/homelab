"""Traefik service — ACME storage initialization."""
from __future__ import annotations

import os

from service import Service, VolumeDir


class TraefikService(Service):
    name = "traefik"
    volume_dirs = [
        VolumeDir("./traefik/volumes", uid=0, gid=0, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🚦 Preparing Traefik volumes...")
        acme_path = "./traefik/volumes/acme.json"
        if not os.path.exists(acme_path):
            with open(acme_path, "w", encoding="utf-8") as f:
                f.write("{}")
            os.chmod(acme_path, 0o600)
            print("   ✅ Generated empty acme.json with secure permissions (0600)")
        else:
            os.chmod(acme_path, 0o600)


service = TraefikService()
