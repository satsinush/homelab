"""Traefik service — ACME storage initialization."""
from __future__ import annotations

import os

from setup.service import Service, VolumeDir, write_host_file
from setup.ui import warn


class TraefikService(Service):
    name = "traefik"
    volume_dirs = [
        VolumeDir("./services/traefik/volumes", mode=0o700),
        # Shared with Stalwart IMAPS/SMTPS (private PEMs or LE dump).
        VolumeDir("./volumes/certificates/stalwart-tls", uid=2000, gid=2000, mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        acme_path = "./services/traefik/volumes/acme.json"
        if not os.path.exists(acme_path) or os.path.isdir(acme_path):
            if os.path.isdir(acme_path):
                warn("acme.json was a directory (Docker mount placeholder); replacing with a file")
                import shutil

                shutil.rmtree(acme_path)
            write_host_file(acme_path, "{}", mode=0o600)
        else:
            try:
                os.chmod(acme_path, 0o600)
            except PermissionError:
                import subprocess

                subprocess.run(["sudo", "chmod", "600", acme_path], check=False)


service = TraefikService()
