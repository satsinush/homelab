"""RustDesk service — console OIDC postsetup + SQLite snapshot."""
from __future__ import annotations

import json
import os
import shutil
import time
from typing import Any

from service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup_utils import gen_secret, network_curl, run_cmd

RUSTDESK_CONSOLE_URL = "http://rustdesk-console:21114"
DOCKER_NETWORK = "homelab-net"


def _read_secret(name: str) -> str:
    path = f"./volumes/secrets/{name}"
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def _container_running() -> bool:
    state = run_cmd(
        "docker inspect -f '{{.State.Running}}' rustdesk-console 2>/dev/null",
        check=False,
    )
    return state == "true"


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _api_data(payload: Any) -> dict[str, Any]:
    data = _as_dict(payload).get("data")
    return data if isinstance(data, dict) else {}


def _api_ok(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("code") == 0


def _api(method: str, path: str, data=None, token: str | None = None):
    url = f"{RUSTDESK_CONSOLE_URL}{path}"
    headers = {"Accept": "application/json"}
    payload = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        payload = json.dumps(data)
    if token:
        headers["api-token"] = token

    body, status = network_curl(DOCKER_NETWORK, method, url, data=payload, headers=headers)
    if status == 0:
        return None, 0
    if not body:
        return None, status
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return {"raw": body}, status
    if isinstance(parsed, dict):
        return parsed, status
    return {"data": parsed}, status


def _wait_for_console(attempts: int = 45) -> bool:
    print("   Waiting for rustdesk-console...")
    for _ in range(attempts):
        if not _container_running():
            time.sleep(2)
            continue
        payload, status = _api("GET", "/health")
        if status == 200 and _as_dict(payload).get("status") == "ok":
            return True
        time.sleep(2)
    return False


def _admin_login(password: str) -> str | None:
    payload, status = _api(
        "POST",
        "/api/admin/login",
        {"username": "admin", "password": password},
    )
    if not _api_ok(payload):
        msg = _as_dict(payload).get("message") or f"HTTP {status}"
        print(f"   ⚠️  Admin login failed: {msg}")
        return None
    token = _api_data(payload).get("token")
    if not isinstance(token, str) or not token:
        print("   ⚠️  Admin login succeeded but no token returned")
        return None
    return token


def _ensure_authentik_oidc(token: str, env: dict) -> bool:
    oidc_secret = _read_secret("rustdesk_oidc_secret")
    if not oidc_secret:
        print("   ⚠️  Missing rustdesk_oidc_secret; skipping OIDC provider setup")
        return False

    provider = {
        "op": "authentik",
        "oauth_type": "oidc",
        "client_id": "rustdesk",
        "client_secret": oidc_secret,
        "issuer": "http://rustdesk-oidc-proxy:8080/application/o/rustdesk/",
        "scopes": "openid,profile,email,groups",
        "auto_register": True,
        "pkce_enable": False,
        "pkce_method": "S256",
    }

    listed, status = _api("GET", "/api/admin/oauth/list?page=1&page_size=100", token=token)
    if not _api_ok(listed):
        msg = _as_dict(listed).get("message") or f"HTTP {status}"
        print(f"   ⚠️  Could not list OAuth providers: {msg}")
        return False

    rows = _api_data(listed).get("list")
    if not isinstance(rows, list):
        rows = []

    existing = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("op") == "authentik" or (
            row.get("oauth_type") == "oidc" and row.get("client_id") == "rustdesk"
        ):
            existing = row
            break

    if existing:
        provider["id"] = existing["id"]
        if not provider["client_secret"] and existing.get("client_secret"):
            provider["client_secret"] = existing["client_secret"]
        result, status = _api("POST", "/api/admin/oauth/update", provider, token=token)
        action = "updated"
    else:
        result, status = _api("POST", "/api/admin/oauth/create", provider, token=token)
        action = "created"

    if not _api_ok(result):
        msg = _as_dict(result).get("message") or f"HTTP {status}"
        print(f"   ⚠️  Failed to {action.rstrip('d')} Authentik OIDC provider: {msg}")
        return False

    print(f"   ✅ Authentik OIDC provider {action} (op=authentik)")
    return True


class RustdeskService(Service):
    name = "rustdesk"
    volume_dirs = [
        VolumeDir("./rustdesk/volumes/server", mode=0o755),
        VolumeDir("./rustdesk/volumes/console", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🖥️  Preparing RustDesk secrets...")
        gen_secret("rustdesk_oidc_secret", 64)
        gen_secret("rustdesk_api_jwt_key", 64)
        gen_secret("rustdesk_admin_password", 32)
        os.makedirs("./volumes/secrets", exist_ok=True)
        rustdesk_key_path = "./volumes/secrets/rustdesk_public_key"
        legacy_key = "./volumes/public-configs/rustdesk_public_key"
        if os.path.isfile(legacy_key) and (
            not os.path.exists(rustdesk_key_path) or os.path.getsize(rustdesk_key_path) == 0
        ):
            shutil.move(legacy_key, rustdesk_key_path)
            print("   ✅ Migrated rustdesk_public_key from volumes/public-configs/")
        if not os.path.exists(rustdesk_key_path):
            with open(rustdesk_key_path, "w", encoding="utf-8") as f:
                f.write("\n")
            os.chmod(rustdesk_key_path, 0o600)
        legacy_pub = "./volumes/public-configs"
        if os.path.isdir(legacy_pub) and not os.listdir(legacy_pub):
            os.rmdir(legacy_pub)
        legacy_env = "./rustdesk/volumes/console.env"
        if os.path.exists(legacy_env):
            os.remove(legacy_env)
            print("   ✅ Removed legacy rustdesk/volumes/console.env")
        print("   ✅ RustDesk secrets ready")

    def postsetup(self, env: dict) -> None:
        print("\n🖥️  Setting up RustDesk console / API server...")

        dest_path = "./volumes/secrets/rustdesk_public_key"
        os.makedirs("./volumes/secrets", exist_ok=True)

        pubkey = ""
        if shutil.which("docker"):
            run_cmd(
                "docker cp rustdesk-id-server:/root/id_ed25519.pub " + dest_path,
                check=False,
            )
            if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                with open(dest_path, "r", encoding="utf-8") as f:
                    pubkey = f.read().strip()
                try:
                    os.chmod(dest_path, 0o600)
                except OSError:
                    pass
                print("   ✅ RustDesk public key extracted to volumes/secrets/rustdesk_public_key")
            else:
                print("   ⚠️  Failed to copy RustDesk key. ID server may not be initialized yet.")
        else:
            print("   ❌ Docker is not installed on host. Skipping RustDesk key extraction.")

        if not pubkey:
            print("   ⚠️  Public key missing; re-run setup after hbbs is up.")

        service_name = env.get("RUSTDESK_SERVICE_NAME", "rustdesk")
        hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
        print(f"   ℹ️  Admin UI: https://{service_name}.{hostname}/_admin/")
        print("   ℹ️  Initial admin password: volumes/secrets/rustdesk_admin_password")

        if not shutil.which("docker"):
            return

        if not _wait_for_console():
            print("   ⚠️  rustdesk-console did not become healthy; skipping OIDC API setup")
            return

        password = _read_secret("rustdesk_admin_password")
        token = _admin_login(password)
        if not token:
            return

        _ensure_authentik_oidc(token, env)

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "rustdesk-console",
            "/app/data/rustdeskapi.db",
            "/app/data/rustdeskapi_snapshot.db",
            host_bind="./rustdesk/volumes/console",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "rustdesk-console",
            "/app/data/rustdeskapi.db",
            "./rustdesk/volumes/console/rustdeskapi_snapshot.db",
            "./rustdesk/volumes/console",
        )


service = RustdeskService()
