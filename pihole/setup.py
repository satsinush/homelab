"""Pi-hole service — bind-mount volume dirs only."""
from __future__ import annotations

from service import Service, VolumeDir


class PiholeService(Service):
    name = "pihole"
    volume_dirs = [
        VolumeDir("./pihole/volumes/etc-pihole", uid=0, gid=0, mode=0o755),
        VolumeDir("./pihole/volumes/logs", uid=0, gid=0, mode=0o755),
    ]


service = PiholeService()
