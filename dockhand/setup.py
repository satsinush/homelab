"""Dockhand service — data bind mount."""
from __future__ import annotations

from service import Service, VolumeDir


class DockhandService(Service):
    name = "dockhand"
    volume_dirs = [
        VolumeDir("./dockhand/volumes/data", uid=0, gid=0, mode=0o755),
    ]


service = DockhandService()
