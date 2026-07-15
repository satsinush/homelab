"""ddclient service — seed gitignored config under volumes/ (restic-backed)."""
from __future__ import annotations

import os
import shutil

from service import Service, VolumeDir

_CONF = "./ddclient/volumes/ddclient.conf"
_EXAMPLE = "./ddclient/example.ddclient.conf"


class DdclientService(Service):
    name = "ddclient"
    volume_dirs = [VolumeDir("./ddclient/volumes", mode=0o700)]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🌐 Preparing ddclient config...")

        if os.path.exists(_CONF):
            if os.path.isdir(_CONF):
                print(
                    f"   ⚠️  {_CONF} is a directory (Docker file-mount placeholder). "
                    "Remove it, then re-run setup to seed from the example."
                )
            else:
                print("   ✅ ddclient.conf already present")
            return

        if not os.path.isfile(_EXAMPLE):
            print(f"   ⚠️  {_EXAMPLE} missing; cannot seed ddclient.conf")
            return

        shutil.copyfile(_EXAMPLE, _CONF)
        os.chmod(_CONF, 0o600)
        print(f"   ✅ Copied {_EXAMPLE} → {_CONF}")
        print("   ℹ️  Edit ddclient.conf with your DDNS provider details before relying on it")


service = DdclientService()
