"""RustDesk service — extract public key from hbbs; no API console."""
from __future__ import annotations

import os
import shutil

from setup.service import Service, VolumeDir
from setup.ui import error, ok, warn
from setup.utils import run_cmd


class RustdeskService(Service):
    name = "rustdesk"
    volume_dirs = [
        VolumeDir("./services/rustdesk/volumes/server", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        os.makedirs("./volumes/secrets", exist_ok=True)
        rustdesk_key_path = "./volumes/secrets/rustdesk_public_key"
        if not os.path.exists(rustdesk_key_path):
            with open(rustdesk_key_path, "w", encoding="utf-8") as f:
                f.write("\n")
            os.chmod(rustdesk_key_path, 0o600)

    def postsetup(self, env: dict) -> None:
        dest_path = "./volumes/secrets/rustdesk_public_key"
        os.makedirs("./volumes/secrets", exist_ok=True)

        if not shutil.which("docker"):
            error("Docker not available; skipping RustDesk key extract")
            return

        run_cmd(
            "docker cp rustdesk-id-server:/root/id_ed25519.pub " + dest_path,
            check=False,
        )
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            try:
                os.chmod(dest_path, 0o600)
            except OSError:
                pass
            ok("RustDesk public key saved")
        else:
            warn("Failed to copy RustDesk key; start hbbs then re-run setup")


service = RustdeskService()
