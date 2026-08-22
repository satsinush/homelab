"""ClipCascade service — database volume and admin secrets."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.utils import gen_secret


class ClipcascadeService(Service):
    name = "clipcascade"
    volume_dirs = [
        VolumeDir("./services/clipcascade/volumes/database", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("clipcascade_admin_password", 32)


service = ClipcascadeService()

