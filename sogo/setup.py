"""SOGo service — Groupware webmail, calendar, and contacts suite."""
from __future__ import annotations

import os

from setup.service import Service, VolumeDir
from setup.ui import ok, section


class SogoService(Service):
    name = "sogo"
    volume_dirs = [
        VolumeDir("./sogo/volumes/config", mode=0o755),
        VolumeDir("./sogo/volumes/db", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing SOGo Groupware...", emoji="✉️")

        config_src = "./sogo/sogo.conf"
        config_dst = "./sogo/volumes/config/sogo.conf"

        if os.path.exists(config_src):
            with open(config_src, "r", encoding="utf-8") as f:
                content = f.read()
            with open(config_dst, "w", encoding="utf-8") as f:
                f.write(content)
            os.chmod(config_dst, 0o644)
            ok(f"Wrote {config_dst}")

        ok("SOGo volume directories ready")


service = SogoService()
