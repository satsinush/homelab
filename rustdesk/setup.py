"""RustDesk service — extract public key from hbbs; no API console."""
from __future__ import annotations

import os
import shutil

from service import Service, VolumeDir
from setup_utils import run_cmd


class RustdeskService(Service):
    name = "rustdesk"
    volume_dirs = [
        VolumeDir("./rustdesk/volumes/server", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🖥️  Preparing RustDesk volumes...")
        os.makedirs("./volumes/secrets", exist_ok=True)
        rustdesk_key_path = "./volumes/secrets/rustdesk_public_key"
        if not os.path.exists(rustdesk_key_path):
            with open(rustdesk_key_path, "w", encoding="utf-8") as f:
                f.write("\n")
            os.chmod(rustdesk_key_path, 0o600)
        print("   ✅ RustDesk volumes ready")

    def postsetup(self, env: dict) -> None:
        print("\n🖥️  Extracting RustDesk public key...")
        dest_path = "./volumes/secrets/rustdesk_public_key"
        os.makedirs("./volumes/secrets", exist_ok=True)

        pubkey = ""
        if shutil.which("docker"):
            run_cmd(
                "docker cp rustdesk-id-server:/root/id_ed25519.pub " + dest_path,
                check=False,
            )
            if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                with open(dest_path, "r", encoding="utf-8") as f:
                    pubkey = f.read().strip()
                try:
                    os.chmod(dest_path, 0o600)
                except OSError:
                    pass
                print("   ✅ Public key → volumes/secrets/rustdesk_public_key")
            else:
                print("   ⚠️  Failed to copy key; start hbbs then re-run setup postsetup")
        else:
            print("   ❌ Docker not available; skipping key extract")

        if pubkey:
            print(f"   ℹ️  Key: {pubkey}")
        print("   ℹ️  Clients: ID/Relay = HOMELAB_IP_ADDRESS; leave API blank; paste key")


service = RustdeskService()
