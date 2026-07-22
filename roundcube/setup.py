"""Roundcube Webmail service — official multi-arch webmail for Maddy IMAP/SMTP."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import ok, section


class RoundcubeService(Service):
    name = "roundcube"
    volume_dirs = [
        VolumeDir("./roundcube/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Roundcube Webmail...", emoji="✉️")
        ok("Roundcube volume directories ready")


service = RoundcubeService()
