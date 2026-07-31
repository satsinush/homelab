"""Alerts gateway & Gotify postsetup — alerts user, per-service apps, URL routing."""
from __future__ import annotations

import json
import os
from typing import Any

from setup.service import Service, VolumeDir, write_host_file
from setup.ui import error, ok, warn
from setup.utils import container_curl, run_cmd, substitute_env_vars, wait_for

# Must match gotify/setup.py
GOTIFY_ALERTS_USERNAME = "alerts"

# Gotify apps owned by the alerts user (name → icon path inside the container).
GOTIFY_APPS: list[dict[str, str]] = [
    {
        "name": "Gatus",
        "description": "Service health monitoring",
        "tag": "gatus",
        "token_env": "GOTIFY_TOKEN_GATUS",
        "icon": "/app/icons/gatus.png",
    },
    {
        "name": "Dashboard",
        "description": "Homelab dashboard alerts (packages, etc.)",
        "tag": "dashboard",
        "token_env": "GOTIFY_TOKEN_DASHBOARD",
        "icon": "/app/icons/homelab.png",
    },
    {
        "name": "Vaultwarden",
        "description": "Vaultwarden / Bitwarden SMTP and alerts",
        "tag": "vaultwarden",
        "token_env": "GOTIFY_TOKEN_VAULTWARDEN",
        "icon": "/app/icons/vaultwarden.png",
    },
    {
        "name": "Dockhand",
        "description": "Dockhand container management alerts",
        "tag": "dockhand",
        "token_env": "GOTIFY_TOKEN_DOCKHAND",
        "icon": "/app/icons/dockhand.png",
    },
    {
        "name": "Mail",
        "description": "New email notifications (Stalwart → Nextcloud Mail)",
        "tag": "mail",
        "token_env": "GOTIFY_TOKEN_MAIL",
        "icon": "/app/icons/stalwart.png",
    },
    {
        "name": "Homelab",
        "description": "General / SMTP fallback alerts",
        "tag": "general",
        "token_env": "GOTIFY_TOKEN_GENERAL",
        "icon": "/app/icons/homelab.png",
    },
]

TOKENS_CACHE = "./services/alerts/volumes/config/gotify_app_tokens.json"


def _gotify_json(
    method: str,
    path: str,
    *,
    auth: str,
    data: dict[str, Any] | None = None,
) -> tuple[Any, int]:
    body, status = container_curl(
        "gotify",
        method,
        f"http://localhost:80{path}",
        data=json.dumps(data) if data is not None else None,
        headers={"Content-Type": "application/json"} if data is not None else None,
        auth=auth,
    )
    try:
        parsed: Any = json.loads(body) if body else None
    except json.JSONDecodeError:
        parsed = body
    return parsed, status


def _load_token_cache() -> dict[str, str]:
    if not os.path.isfile(TOKENS_CACHE):
        return {}
    try:
        with open(TOKENS_CACHE, encoding="utf-8") as f:
            raw = json.load(f)
        return {str(k): str(v) for k, v in raw.items() if v}
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def _save_token_cache(tokens: dict[str, str]) -> None:
    os.makedirs(os.path.dirname(TOKENS_CACHE), exist_ok=True)
    with open(TOKENS_CACHE, "w", encoding="utf-8") as f:
        json.dump(tokens, f, indent=2, sort_keys=True)
        f.write("\n")
    try:
        os.chmod(TOKENS_CACHE, 0o600)
    except OSError:
        pass


def _ensure_admin_password(admin_pwd: str) -> None:
    # First boot default is admin:admin; ignore failure if already changed.
    _gotify_json(
        "POST",
        "/current/user/password",
        auth="admin:admin",
        data={"pass": admin_pwd},
    )


def _ensure_alerts_user(admin_auth: str, alerts_pwd: str) -> None:
    users, status = _gotify_json("GET", "/user", auth=admin_auth)
    if status != 200 or not isinstance(users, list):
        warn(f"Could not list Gotify users (HTTP {status})")
        return

    existing = next((u for u in users if u.get("name") == GOTIFY_ALERTS_USERNAME), None)
    if existing:
        uid = existing["id"]
        _, put_status = _gotify_json(
            "POST",
            f"/user/{uid}",
            auth=admin_auth,
            data={"name": GOTIFY_ALERTS_USERNAME, "pass": alerts_pwd, "admin": False},
        )
        if put_status not in (200, 204):
            warn(f"Could not update `{GOTIFY_ALERTS_USERNAME}` password (HTTP {put_status})")
        return

    created, create_status = _gotify_json(
        "POST",
        "/user",
        auth=admin_auth,
        data={"name": GOTIFY_ALERTS_USERNAME, "pass": alerts_pwd, "admin": False},
    )
    if create_status != 200:
        warn(f"Failed to create `{GOTIFY_ALERTS_USERNAME}` (HTTP {create_status}): {created}")


def _ensure_app(
    alerts_auth: str,
    spec: dict[str, str],
    token_cache: dict[str, str],
) -> str | None:
    name = spec["name"]
    apps, status = _gotify_json("GET", "/application", auth=alerts_auth)
    if status != 200 or not isinstance(apps, list):
        warn(f"Could not list applications (HTTP {status})")
        return token_cache.get(name)

    existing = next((a for a in apps if a.get("name") == name), None)
    app_id = None
    token = None
    if existing:
        app_id = existing.get("id")
        token = existing.get("token") or token_cache.get(name)
        if not token:
            warn(
                f"App `{name}` exists but token unknown "
                "(Gotify hides tokens after create). Delete it in the UI to recreate."
            )
            return None
    else:
        created, create_status = _gotify_json(
            "POST",
            "/application",
            auth=alerts_auth,
            data={"name": name, "description": spec["description"]},
        )
        if create_status != 200 or not isinstance(created, dict):
            warn(f"Failed to create app `{name}` (HTTP {create_status}): {created}")
            return token_cache.get(name)
        app_id = created.get("id")
        token = created.get("token")

    if token:
        token_cache[name] = token

    icon = spec.get("icon")
    if app_id and icon:
        # Pass auth via env so passwords with shell metacharacters stay safe.
        run_cmd(
            [
                "docker",
                "exec",
                "-e",
                f"GOTIFY_BASIC_AUTH={alerts_auth}",
                "gotify",
                "sh",
                "-c",
                f'curl -s -u "$GOTIFY_BASIC_AUTH" -F "file=@{icon}" '
                f'"http://localhost:80/application/{app_id}/image"',
            ],
            shell=False,
            check=False,
        )

    return token


class AlertsService(Service):
    name = "alerts"
    volume_dirs = [
        VolumeDir("./services/alerts/volumes/config", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)

    def postsetup(self, env: dict) -> None:
        admin_pwd = os.environ.get("GOTIFY_ADMIN_PASSWORD") or ""
        alerts_pwd = os.environ.get("GOTIFY_ALERTS_PASSWORD") or ""
        if not admin_pwd or not alerts_pwd:
            error("Missing GOTIFY_ADMIN_PASSWORD or GOTIFY_ALERTS_PASSWORD secrets")
            return

        if not wait_for(
            lambda: container_curl("gotify", "GET", "http://localhost:80/version")[1]
            == 200,
            timeout=60,
            interval=2,
        ):
            error("Gotify failed to start or did not become ready.")
            return

        _ensure_admin_password(admin_pwd)
        admin_auth = f"admin:{admin_pwd}"
        _ensure_alerts_user(admin_auth, alerts_pwd)
        alerts_auth = f"{GOTIFY_ALERTS_USERNAME}:{alerts_pwd}"

        # Verify alerts login
        _apps, auth_status = _gotify_json("GET", "/application", auth=alerts_auth)
        if auth_status != 200:
            error(f"Cannot authenticate as `{GOTIFY_ALERTS_USERNAME}` (HTTP {auth_status})")
            return

        token_cache = _load_token_cache()
        tokens_by_env: dict[str, str] = {}
        for spec in GOTIFY_APPS:
            token = _ensure_app(alerts_auth, spec, token_cache)
            if token:
                tokens_by_env[spec["token_env"]] = token

        _save_token_cache(token_cache)

        missing = [s["token_env"] for s in GOTIFY_APPS if s["token_env"] not in tokens_by_env]
        if missing:
            error(f"Missing Gotify app tokens: {', '.join(missing)}")
            return

        for key, value in tokens_by_env.items():
            os.environ[key] = value

        config_dir = "./services/alerts/volumes/config"
        os.makedirs(config_dir, exist_ok=True)
        template_path = "./services/alerts/urls.yaml"
        with open(template_path, encoding="utf-8") as f:
            template = f.read()
        urls_content = substitute_env_vars(template)
        write_host_file(f"{config_dir}/urls.yaml", urls_content, mode=0o600)
        container_curl("alerts", "GET", "http://localhost:80/health")
        ok("Alerts notification gateway ready")


service = AlertsService()
