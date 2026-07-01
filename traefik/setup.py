"""Traefik setup — directories and ACME certificate storage initialization."""
import os


def setup(env):
    """Ensure Traefik volume exists and acme.json is created with correct permissions."""
    print("\n🚦 Preparing Traefik volumes...")
    
    os.makedirs("./traefik/volumes", exist_ok=True)
    acme_path = "./traefik/volumes/acme.json"
    
    if not os.path.exists(acme_path):
        with open(acme_path, "w") as f:
            f.write("{}")
        os.chmod(acme_path, 0o600)
        print("   ✅ Generated empty acme.json with secure permissions (0600)")
