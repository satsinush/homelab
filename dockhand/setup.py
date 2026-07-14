"""Dockhand service — data bind mount."""
from __future__ import annotations

from service import Service, VolumeDir


class DockhandService(Service):
    name = "dockhand"
    volume_dirs = [
        VolumeDir("./dockhand/volumes/data", mode=0o755),
    ]


service = DockhandService()
