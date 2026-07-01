"""Vaultwarden setup — environment secrets configuration."""
import os


def setup(env):
    """Write vaultwarden.env configuration file from loaded environment secrets."""
    print("\n🔐 Preparing Vaultwarden env file...")
    
    os.makedirs("./volumes/secrets", exist_ok=True)
    
    vw_env_content = f"""ADMIN_TOKEN={os.environ.get("VAULTWARDEN_ADMIN_TOKEN")}
SSO_CLIENT_SECRET={os.environ.get("VAULTWARDEN_OIDC_SECRET")}
SMTP_PASSWORD={os.environ.get("HOMELAB_PASSWORD")}
"""
    
    env_path = "./volumes/secrets/vaultwarden.env"
    with open(env_path, "w") as f:
        f.write(vw_env_content)
    
    os.chmod(env_path, 0o600)
    print("   ✅ Generated vaultwarden.env configuration")
