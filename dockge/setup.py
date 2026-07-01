"""Dockge setup — directories initialization."""
import os


def setup(env):
    """Ensure Dockge stacks and data volume directories exist."""
    print("\n🐳 Preparing Dockge volumes...")
    os.makedirs("./dockge/volumes/stacks", exist_ok=True)
    os.makedirs("./dockge/volumes/data", exist_ok=True)
    print("   ✅ Dockge volume directories ready")
