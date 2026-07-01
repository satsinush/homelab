"""Authentik setup — volume directories initialization."""
import os


def setup(env):
    """Ensure Authentik media directory exists."""
    print("\n🔑 Preparing Authentik volumes...")
    os.makedirs("./authentik/volumes/media", exist_ok=True)
    print("   ✅ Authentik volume directories ready")
