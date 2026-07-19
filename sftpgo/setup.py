"""SFTPGo WebDAV — local users from volumes/accounts/accounts.json (no Authentik LDAP)."""
from __future__ import annotations

import json
import os

from setup.file_accounts import read_accounts_json
from setup.service import Service, VolumeDir
from setup.storage_layout import ensure_all_user_homes, ensure_storage_layout, ensure_user_home
from setup.ui import info, ok, section, warn

_USERS_HOME_PREFIX = "/srv/sftpgo/storage/users/"
LOADDATA_PATH = "./sftpgo/volumes/config/loaddata.json"
CONFIG_PATH = "./sftpgo/volumes/config/sftpgo.json"
SHARED_GROUP = "file-users"

# Public URL prefix for both WebDAV and the web client UI.
_DAV_PREFIX = "/files"


def write_sftpgo_loaddata(users_list: list[dict], env: dict | None = None) -> str:
    """Generate loaddata.json: shared folder + local users from accounts.json."""
    puid = int(os.environ.get("PUID") or "1000")
    pgid = int(os.environ.get("PGID") or "1000")

    users = []
    folders = [
        {
            "name": "shared",
            "mapped_path": "/srv/sftpgo/storage/shared",
            "description": "Shared storage for all file-access users",
            "filesystem": {"provider": 0},
        }
    ]

    for user_obj in sorted(users_list, key=lambda u: u["username"]):
        username = user_obj["username"]
        password = user_obj["password"]
        
        ensure_user_home(username, puid, pgid)
        # Create a single shared empty directory inside sftpgo volumes to serve as the user's isolated home root.
        # This keeps the root directory "/" clean and avoids cluttering storage or creating directories per user.
        home_root_dir = "/var/lib/sftpgo/home_roots/empty_root"
        os.makedirs("./sftpgo/volumes/data/home_roots/empty_root", exist_ok=True)
        
        # Add user's personal directory as an SFTPGo folder
        folders.append(
            {
                "name": f"personal_{username}",
                "mapped_path": f"{_USERS_HOME_PREFIX}{username}",
                "description": f"Personal storage for {username}",
                "filesystem": {"provider": 0},
            }
        )

        users.append(
            {
                "status": 1,
                "username": username,
                "password": password,
                "home_dir": home_root_dir,
                "permissions": {
                    "/": ["list", "download"],
                    "/personal": ["*"],
                    "/shared": ["*"]
                },
                "filters": {
                    "web_client": ["password-change-disabled"]
                },
                "virtual_folders": [
                    {
                        "name": f"personal_{username}",
                        "virtual_path": "/personal",
                        "quota_size": 0,
                        "quota_files": 0,
                    },
                    {
                        "name": "shared",
                        "virtual_path": "/shared",
                        "quota_size": 0,
                        "quota_files": 0,
                    }
                ],
            }
        )

    admin_user = (env.get("HOMELAB_USERNAME") if env else None) or os.environ.get("HOMELAB_USERNAME") or "admin"
    admin_user = admin_user.lower()
    pw_path = "./volumes/secrets/homelab_password"
    admin_pw = ""
    if os.path.isfile(pw_path):
        with open(pw_path, encoding="utf-8") as f:
            admin_pw = f.read().strip()

    payload = {
        "admins": [
            {
                "username": admin_user,
                "password": admin_pw or "changeme",
                "status": 1,
                "permissions": ["*"],
            }
        ] if admin_pw or admin_user else [],
        "users": users,
        "folders": folders,
        "groups": [],
        "version": 17,
    }

    os.makedirs(os.path.dirname(LOADDATA_PATH), exist_ok=True)
    with open(LOADDATA_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    try:
        os.chmod(LOADDATA_PATH, 0o600)
    except OSError:
        pass
    return LOADDATA_PATH


def write_sftpgo_config() -> str:
    """Generate sftpgo.json with WebDAV prefix and HTTPD web root set to _DAV_PREFIX."""
    config = {
        "webdavd": {
            "bindings": [
                {
                    "address": "",
                    "port": 8080,
                    "prefix": _DAV_PREFIX,
                }
            ],
            "enable_dir_listing": True,
        },
        "httpd": {
            "bindings": [
                {
                    "address": "",
                    "port": 8081,
                    "enable_web_admin": False,
                    "enable_web_client": True,
                }
            ],
            "web_root": _DAV_PREFIX,
        },
    }
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        f.write("\n")
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass
    return CONFIG_PATH


class SftpgoService(Service):
    name = "sftpgo"
    volume_dirs = [
        VolumeDir("./sftpgo/volumes/data", mode=0o755),
        VolumeDir("./sftpgo/volumes/config", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing SFTPGo / WebDAV...", emoji="📂")
        puid = int(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = int(env.get("PGID") or os.environ.get("PGID") or "1000")
        ensure_storage_layout(puid, pgid)
        ensure_all_user_homes(puid, pgid)
        
        users = read_accounts_json()
        write_sftpgo_loaddata(users, env=env)
        write_sftpgo_config()
        ok(f"Wrote SFTPGo config (WebDAV+HTTPD prefix: {_DAV_PREFIX})")
        if users:
            ok(f"WebDAV users synced ({len(users)})")
        else:
            warn("No accounts in accounts.json yet")
        info("WebDAV / = private home; /shared = storage/shared")

    def sync_accounts(self, env: dict, users: list[dict]) -> bool:
        write_sftpgo_loaddata(users, env=env)
        write_sftpgo_config()
        return True


service = SftpgoService()
