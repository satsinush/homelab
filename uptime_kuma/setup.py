"""Uptime Kuma setup — directories initialization."""
import os


def setup(env):
    """Ensure Uptime Kuma data directory exists."""
    print("\n📈 Preparing Uptime Kuma volumes...")
    os.makedirs("./uptime-kuma/volumes/data", exist_ok=True)
    print("   ✅ Uptime Kuma volume directory ready")
