"""Pi-hole service — bind-mount volume dirs owned by PUID/PGID."""
from __future__ import annotations

import os

from service import Service, VolumeDir


class PiholeService(Service):
    name = "pihole"

    def setup(self, env: dict) -> None:
        puid = int(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = int(env.get("PGID") or os.environ.get("PGID") or "1000")
        self.volume_dirs = [
            VolumeDir("./pihole/volumes/etc-pihole", uid=puid, gid=pgid, mode=0o755),
            VolumeDir("./pihole/volumes/logs", uid=puid, gid=pgid, mode=0o755),
        ]
        super().setup(env)


service = PiholeService()
