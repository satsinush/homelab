"""Portainer setup — admin initialization and SSO configuration."""
import os
import sys
import re
import json
import time

from setup_utils import container_curl, run_cmd


def setup(env):
    """Configure Portainer admin user and SSO settings."""
    print("\n⚙️  Configuring Portainer...")
    portainer_pwd = os.environ.get("PORTAINER_ADMIN_PASSWORD")
    portainer_oidc_secret = os.environ.get("PORTAINER_OIDC_SECRET")

    # Check if admin initialized
    body, status = container_curl("portainer", "GET", "http://localhost:9000/api/users/admin/check")
    if status == 404:
        print("   Extracting setup token...")
        setup_token = ""
        for _ in range(30):
            logs = run_cmd("docker logs portainer 2>&1", check=False)
            if logs:
                # Strip ANSI escape sequences
                clean_logs = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', logs)
                match = re.search(r"setup_token=([a-zA-Z0-9]+)", clean_logs)
                if match:
                    setup_token = match.group(1)
                    break
            time.sleep(1)

        if not setup_token:
            print("   ❌ Failed to extract Portainer setup token from logs")
            sys.exit(1)

        print("   Initializing admin user...")
        init_data = f'{{"username": "admin", "password": "{portainer_pwd}"}}'
        container_curl("portainer", "POST", "http://localhost:9000/api/users/admin/init", data=init_data, headers={"X-Setup-Token": setup_token})
    else:
        print("   Admin user already initialized.")

    # Get Token
    auth_data = f'{{"username": "admin", "password": "{portainer_pwd}"}}'
    body, status = container_curl("portainer", "POST", "http://localhost:9000/api/auth", data=auth_data, headers={"Content-Type": "application/json"})
    try:
        token = json.loads(body).get("jwt")
    except Exception:
        token = None

    if not token or token == "null":
        print("   ❌ Failed to authenticate with Portainer")
        sys.exit(1)

    print("   Configuring SSO settings...")
    oauth_payload = json.dumps({
        "authenticationMethod": 3,
        "oauthSettings": {
            "SSO": True,
            "OAuthAutoCreateUsers": True,
            "ClientID": "portainer",
            "ClientSecret": portainer_oidc_secret,
            "AccessTokenURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/token/",
            "AuthorizationURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/authorize/",
            "ResourceURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/userinfo/",
            "RedirectURI": f"https://{env.get('PORTAINER_WEB_HOSTNAME')}",
            "LogoutURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/portainer/end-session/",
            "UserIdentifier": "preferred_username",
            "Scopes": "openid profile email groups"
        }
    })

    body, status = container_curl("portainer", "PUT", "http://localhost:9000/api/settings", data=oauth_payload, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })

    if status == 200:
        print("   ✅ Portainer SSO configured")
    else:
        print(f"   ❌ Failed to configure Portainer SSO (HTTP: {status})")
        sys.exit(1)
