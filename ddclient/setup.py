"""ddclient service — seed gitignored config from the example on first setup."""
from __future__ import annotations

import os
import shutil

from service import Service

_CONF = "./ddclient/ddclient.conf"
_EXAMPLE = "./ddclient/example.ddclient.conf"


class DdclientService(Service):
    name = "ddclient"
    volume_dirs = []
    reset_extra_paths = [_CONF]

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
