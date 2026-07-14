"""Unbound service — redis cache bind mount."""
from __future__ import annotations

from service import Service, VolumeDir


class UnboundService(Service):
    name = "unbound"
    volume_dirs = [
        VolumeDir("./unbound/volumes/redis", uid=999, gid=999, mode=0o755),
    ]


service = UnboundService()
