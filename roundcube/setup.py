"""Roundcube Webmail service — official multi-arch webmail for Maddy IMAP/SMTP."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import ok, section
from setup.utils import run_cmd

# UID/GID of www-data inside roundcube/roundcubemail (Apache/Debian base)
_WWW_DATA_UID = 33


class RoundcubeService(Service):
    name = "roundcube"
    volume_dirs = [
        VolumeDir("./roundcube/volumes/data", mode=0o755),
        VolumeDir("./roundcube/volumes/db", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Roundcube Webmail...", emoji="✉️")

        for path in ("./roundcube/volumes/data", "./roundcube/volumes/db"):
            run_cmd(f"sudo chown -R {_WWW_DATA_UID}:{_WWW_DATA_UID} {path} 2>/dev/null || true")

        ok("Roundcube volume directories ready")


service = RoundcubeService()
