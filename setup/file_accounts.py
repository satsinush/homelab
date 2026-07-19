#!/usr/bin/env python3
"""Central controller for file-access credentials store (accounts.json) and service synchronization.

Allows adding, listing, editing, and deleting users, and runs the sync hooks
for services that depend on these credentials (Samba, SFTPGo, Radicale).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import subprocess

# Ensure imports from parent directory resolve correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from setup.ui import ok, error, section, step, warn, info
from setup.utils import load_env

ACCOUNTS_JSON = "./volumes/accounts/accounts.json"


def safe_username(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "", name.strip()).lower()
    if not cleaned:
        raise ValueError("empty username")
    return cleaned


def validate_password(password: str) -> None:
    if not password or len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    if "\r" in password or "\n" in password:
        raise ValueError("password cannot contain newlines")


def read_accounts_json(path: str = ACCOUNTS_JSON) -> list[dict]:
    """Parse accounts.json -> list of user dicts."""
    if not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and "users" in data:
                return data["users"]
            if isinstance(data, list):
                return data
    except Exception as e:
        warn(f"Failed to read {path}: {e}")
    return []


def write_accounts_json(users: list[dict], path: str = ACCOUNTS_JSON) -> None:
    """Save users list to accounts.json."""
    parent = os.path.dirname(path)
    os.makedirs(parent, mode=0o700, exist_ok=True)
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass
    
    payload = {"users": sorted(users, key=lambda u: u["username"])}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def trigger_accounts_sync(recreate: bool = True) -> None:
    """Notify services that account details changed so they compile setups & restart."""
    section("Synchronizing service configurations from accounts.json...", emoji="🔄")
    
    # Load environment variables
    env = {}
    if os.path.isfile(".env"):
        env = load_env(".env")
    
    users = read_accounts_json()
    
    # Import services registry
    from setup.registry import get_services
    services = get_services()
    
    triggered_services = []
    
    for svc in services:
        step(f"Running account sync hook for service: {svc.name}")
        try:
            needs_recreate = svc.sync_accounts(env, users)
            if needs_recreate:
                triggered_services.append(svc.name)
        except Exception as e:
            error(f"Sync hook failed for {svc.name}: {e}")
                
    if recreate and triggered_services:
        # Filter docker compose command to only services that synced
        step(f"Recreating containers for: {', '.join(triggered_services)}")
        subprocess.run(
            ["docker", "compose", "up", "-d", "--force-recreate"] + triggered_services,
            check=True
        )
        ok("Services successfully recreated and synced.")
    else:
        ok("Sync process complete (no service recreations required).")


def run_list() -> None:
    users = read_accounts_json()
    print(json.dumps([{"username": u["username"], "isAdmin": u.get("isAdmin", False)} for u in users], indent=2))


def run_create(username_raw: str, password_raw: str, is_admin: bool) -> None:
    username = safe_username(username_raw)
    validate_password(password_raw)
    
    users = read_accounts_json()
    if any(u["username"] == username for u in users):
        raise ValueError(f"user '{username}' already exists")
    
    users.append({
        "username": username,
        "password": password_raw,
        "isAdmin": is_admin
    })
    write_accounts_json(users)
    ok(f"Created user account: '{username}'")
    trigger_accounts_sync(recreate=True)


def run_update_password(username_raw: str, password_raw: str, is_admin: bool | None = None) -> None:
    username = safe_username(username_raw)
    validate_password(password_raw)
    
    users = read_accounts_json()
    found = False
    for u in users:
        if u["username"] == username:
            u["password"] = password_raw
            if is_admin is not None:
                u["isAdmin"] = is_admin
            found = True
            break
            
    if not found:
        raise ValueError(f"user '{username}' not found")
        
    write_accounts_json(users)
    ok(f"Updated password for user: '{username}'")
    trigger_accounts_sync(recreate=True)


def run_delete(username_raw: str) -> None:
    username = safe_username(username_raw)
    
    users = read_accounts_json()
    filtered = [u for u in users if u["username"] != username]
    if len(filtered) == len(users):
        raise ValueError(f"user '{username}' not found")
        
    write_accounts_json(filtered)
    ok(f"Deleted user account: '{username}'")
    trigger_accounts_sync(recreate=True)


def main() -> None:
    # Always work relative to repository root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(project_root)
    
    parser = argparse.ArgumentParser(description="Homelab user account manager")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    subparsers.add_parser("list")
    
    create_parser = subparsers.add_parser("create")
    create_parser.add_argument("username")
    create_parser.add_argument("password")
    create_parser.add_argument("--admin", action="store_true")
    
    update_parser = subparsers.add_parser("update-password")
    update_parser.add_argument("username")
    update_parser.add_argument("password")
    update_parser.add_argument("--admin", type=bool, default=None)
    
    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("username")
    
    subparsers.add_parser("sync")
    
    args = parser.parse_args()
    
    try:
        if args.command == "list":
            run_list()
        elif args.command == "create":
            run_create(args.username, args.password, args.admin)
        elif args.command == "update-password":
            run_update_password(args.username, args.password, args.admin)
        elif args.command == "delete":
            run_delete(args.username)
        elif args.command == "sync":
            trigger_accounts_sync(recreate=True)
    except Exception as e:
        error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
