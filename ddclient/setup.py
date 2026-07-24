"""ddclient service — seed gitignored config under volumes/ (restic-backed)."""
from __future__ import annotations

import os
import shutil

from setup.service import Service, VolumeDir
from setup.ui import info, ok, section, warn

_CONF = "./ddclient/volumes/ddclient.conf"
_EXAMPLE = "./ddclient/example.ddclient.conf"


class DdclientService(Service):
    name = "ddclient"
    volume_dirs = [VolumeDir("./ddclient/volumes", mode=0o700)]

    def reset_paths(self) -> list[str]:
        # volumes/ only holds user-edited ddclient.conf — keep it across reset.
        return []

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing ddclient config...", emoji="🌐")

        if os.path.exists(_CONF):
            if os.path.isdir(_CONF):
                warn(
                    f"{_CONF} is a directory (Docker file-mount placeholder). "
                    "Remove it, then re-run setup to seed from the example."
                )
            else:
                ok("ddclient.conf already present")
            return

        if not os.path.isfile(_EXAMPLE):
            warn(f"{_EXAMPLE} missing; cannot seed ddclient.conf")
            return

        shutil.copyfile(_EXAMPLE, _CONF)
        os.chmod(_CONF, 0o600)
        ok(f"Copied {_EXAMPLE} → {_CONF}")
        info("Edit ddclient.conf with your DDNS provider details before relying on it")


service = DdclientService()
