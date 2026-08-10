"""ddclient service — seed gitignored config under volumes/ (restic-backed)."""
from __future__ import annotations

import os
import shutil

from setup.service import Service, VolumeDir
from setup.ui import ok, warn

_CONF = "./services/ddclient/volumes/ddclient.conf"
_EXAMPLE = "./services/ddclient/example.ddclient.conf"


class DdclientService(Service):
    name = "ddclient"
    volume_dirs = [VolumeDir("./services/ddclient/volumes", mode=0o700)]

    def reset_paths(self) -> list[str]:
        # volumes/ only holds user-edited ddclient.conf — keep it across reset.
        return []

    def setup(self, env: dict) -> None:
        super().setup(env)

        if os.path.exists(_CONF):
            if os.path.isdir(_CONF):
                warn(
                    f"{_CONF} is a directory (Docker file-mount placeholder). "
                    "Remove it, then re-run setup to seed from the example."
                )
            return

        if not os.path.isfile(_EXAMPLE):
            warn(f"{_EXAMPLE} missing; cannot seed ddclient.conf")
            return

        shutil.copyfile(_EXAMPLE, _CONF)
        os.chmod(_CONF, 0o600)
        ok(f"Seeded {_CONF} from example — edit before relying on DDNS")


service = DdclientService()
