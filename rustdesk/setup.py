"""RustDesk setup — public key extraction from running container."""
import shutil
from setup_utils import run_cmd


def setup(env):
    """Copy the generated RustDesk public key from the container to the secrets volume."""
    print("\n🖥️  Extracting RustDesk Public Key to secrets...")
    
    if shutil.which("docker"):
        res = run_cmd("docker cp rustdesk-id-server:/root/data/key.pub ./volumes/secrets/rustdesk_public_key", check=False)
        if res is not None:
            print("   ✅ RustDesk Public Key extracted to volumes/secrets/rustdesk_public_key")
        else:
            print("   ⚠️  Failed to copy RustDesk key. RustDesk container may not be initialized yet.")
    else:
        print("   ❌ Docker is not installed on host. Skipping RustDesk key extraction.")
