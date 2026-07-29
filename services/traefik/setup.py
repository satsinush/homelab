"""Traefik service — ACME storage initialization."""
from __future__ import annotations

import os

from setup.service import Service, VolumeDir, write_host_file
from setup.ui import ok, section, warn


class TraefikService(Service):
    name = "traefik"
    volume_dirs = [
        VolumeDir("./services/traefik/volumes", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Traefik volumes...", emoji="🚦")
        acme_path = "./services/traefik/volumes/acme.json"
        if not os.path.exists(acme_path) or os.path.isdir(acme_path):
            if os.path.isdir(acme_path):
                warn("acme.json was a directory (Docker mount placeholder); replacing with a file")
                import shutil

                shutil.rmtree(acme_path)
            write_host_file(acme_path, "{}", mode=0o600)
            ok("Generated empty acme.json with secure permissions (0600)")
        else:
            try:
                os.chmod(acme_path, 0o600)
            except PermissionError:
                import subprocess

                subprocess.run(["sudo", "chmod", "600", acme_path], check=False)


service = TraefikService()
