import os
import shutil
from setup_utils import run_cmd


def setup(env):
    """Copy the generated RustDesk public key from the container to the secrets volume."""
    print("\n🖥️  Extracting RustDesk Public Key to secrets...")
    
    dest_path = "./volumes/public-configs/rustdesk_public_key"
    if shutil.which("docker"):
        run_cmd("docker cp rustdesk-id-server:/root/id_ed25519.pub " + dest_path, check=False)
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            print("   ✅ RustDesk Public Key extracted to volumes/public-configs/rustdesk_public_key")
        else:
            print("   ⚠️  Failed to copy RustDesk key. RustDesk container may not be initialized yet.")
    else:
        print("   ❌ Docker is not installed on host. Skipping RustDesk key extraction.")
