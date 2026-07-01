"""Authentik setup — volume directories initialization."""
import os


def setup(env):
    """Ensure Authentik media directory and public folder exist with empty file placeholder."""
    print("\n🔑 Preparing Authentik volumes...")
    
    # Create public folder inside media volume
    public_dir = "./authentik/volumes/media/public"
    os.makedirs(public_dir, exist_ok=True)
    
    # Create/touch an empty file placeholder so Docker mounts it as a file, not a directory
    placeholder_path = os.path.join(public_dir, "homelab-icon.svg")
    if not os.path.exists(placeholder_path):
        with open(placeholder_path, "w") as f:
            pass # touch file
            
    print("   ✅ Authentik volume directories ready")
