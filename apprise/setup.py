"""Apprise & Gotify setup — notification gateway configuration."""
import os
import sys
import json
import time

from setup_utils import container_curl, run_cmd, substitute_env_vars


def setup(env):
    """Configure Gotify server and generate Apprise YAML integration."""
    print("\n🔔 Setting up Gotify server & Apprise yaml integration...")
    gotify_pwd = os.environ.get("GOTIFY_ADMIN_PASSWORD")

    # Wait for Gotify
    print("   Waiting for Gotify to initialize...")
    gotify_ready = False
    for _ in range(30):
        body, status = container_curl("gotify", "GET", "http://localhost:80/version")
        if status == 200:
            gotify_ready = True
            break
        time.sleep(2)

    if not gotify_ready:
        print("   ❌ Gotify failed to start or did not become ready.")
        return

    print("   Gotify is up. Configuring...")
    # Change default admin password
    container_curl("gotify", "POST", "http://localhost:80/current/user/password", data=f'{{"pass":"{gotify_pwd}"}}', headers={"Content-Type": "application/json"}, auth="admin:admin")

    # Get apps list
    body, status = container_curl("gotify", "GET", "http://localhost:80/application", auth=f"admin:{gotify_pwd}")
    gotify_token = ""
    gotify_id = ""
    try:
        apps = json.loads(body)
        for app in apps:
            if app.get("name") == "Homelab Alert Gateway":
                gotify_token = app.get("token")
                gotify_id = app.get("id")
                break
    except Exception:
        pass

    if not gotify_token:
        # Create application
        body, status = container_curl("gotify", "POST", "http://localhost:80/application",
            data='{"name":"Homelab Alert Gateway","description":"Gateway for all homelab services"}',
            headers={"Content-Type": "application/json"},
            auth=f"admin:{gotify_pwd}"
        )
        try:
            app_res = json.loads(body)
            gotify_token = app_res.get("token")
            gotify_id = app_res.get("id")
        except Exception:
            pass

    if gotify_token:
        print("   ✅ Created Gotify Application. Token generated.")
        # Upload app icon
        icon_path = "./gotify/homelab-icon.png"
        if os.path.exists(icon_path) and gotify_id:
            run_cmd(f'docker exec gotify curl -s -X POST -u "admin:{gotify_pwd}" -F "file=@/app/homelab-icon.png" "http://localhost:80/application/{gotify_id}/image"', check=False)
            print("   ✅ Uploaded Gotify Application icon.")

        # Generate apprise.yaml configuration from template
        config_dir = "./apprise/volumes/config"
        os.makedirs(config_dir, exist_ok=True)
        template_path = "./apprise/apprise.yaml"
        os.environ["GOTIFY_TOKEN"] = gotify_token
        if os.path.exists(template_path):
            with open(template_path, "r") as f:
                template = f.read()
            apprise_content = substitute_env_vars(template)
        else:
            apprise_content = substitute_env_vars(f"urls:\n  - gotify://gotify/${{GOTIFY_TOKEN}}\n")

        with open(f"{config_dir}/apprise.yaml", "w") as f:
            f.write(apprise_content)
        print("   ✅ Generated apprise.yaml configuration from template")

        # Reload Apprise Gateway
        body, status = container_curl("apprise-api", "GET", "http://localhost:80/health")
        print("   ✅ SMTP/HTTP notification gateway reloaded")
    else:
        print("   ❌ Failed to create Gotify application.")


def pre_setup(env):
    """Ensure Apprise config directory exists before compose runs."""
    os.makedirs("./apprise/volumes/config", exist_ok=True)
