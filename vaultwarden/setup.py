"""Vaultwarden setup — environment secrets configuration."""
import os
import secrets
import shlex
from setup_utils import run_cmd


def setup(env):
    """Write vaultwarden.env configuration file from loaded environment secrets."""
    print("\n🔐 Preparing Vaultwarden env file...")
    
    os.makedirs("./volumes/secrets", exist_ok=True)
    
    plain_token = os.environ.get("VAULTWARDEN_ADMIN_TOKEN")
    admin_token_val = plain_token
    
    # Generate Argon2 hash of the plain-text token
    print("   Generating secure Argon2 hash for Vaultwarden ADMIN_TOKEN...")
    try:
        # Generate a random 8-byte (16 hex character) salt
        salt = secrets.token_hex(8)
        hashed = run_cmd(f"echo -n {shlex.quote(plain_token)} | argon2 {salt} -id -e")
        if hashed:
            admin_token_val = hashed.replace('$', '$$')
            print("   ✅ Secure Argon2 hash generated for ADMIN_TOKEN")
        else:
            print("   ⚠️  Failed to generate Argon2 hash. Using plain text fallback.")
    except Exception as e:
        print(f"   ⚠️  Failed to generate Argon2 hash: {e}. Using plain text fallback.")
    
    vw_env_content = f"""ADMIN_TOKEN={admin_token_val}
SSO_CLIENT_SECRET={os.environ.get("VAULTWARDEN_OIDC_SECRET")}
"""
    
    env_path = "./volumes/secrets/vaultwarden.env"
    with open(env_path, "w") as f:
        f.write(vw_env_content)
    
    os.chmod(env_path, 0o600)
    print("   ✅ Generated vaultwarden.env configuration")
