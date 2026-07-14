"""Traefik service — ACME storage initialization."""
from __future__ import annotations

import os

from service import Service, VolumeDir, write_host_file


class TraefikService(Service):
    name = "traefik"
    volume_dirs = [
        VolumeDir("./traefik/volumes", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🚦 Preparing Traefik volumes...")
        acme_path = "./traefik/volumes/acme.json"
        if not os.path.exists(acme_path):
            write_host_file(acme_path, "{}", mode=0o600)
            print("   ✅ Generated empty acme.json with secure permissions (0600)")
        else:
            try:
                os.chmod(acme_path, 0o600)
            except PermissionError:
                import subprocess

                subprocess.run(["sudo", "chmod", "600", acme_path], check=False)


service = TraefikService()
