"""SFTPGo WebDAV — local users from volumes/accounts/accounts.env (no Authentik LDAP)."""
from __future__ import annotations

import json
import os

from setup.file_accounts import ACCOUNTS_ENV, read_accounts_env
from setup.service import Service, VolumeDir
from setup.storage_layout import ensure_all_user_homes, ensure_storage_layout, ensure_user_home
from setup.ui import info, ok, section, warn
from setup.utils import compose_up


_USERS_HOME_PREFIX = "/srv/sftpgo/storage/users/"
LOADDATA_PATH = "./sftpgo/volumes/config/loaddata.json"
CONFIG_PATH = "./sftpgo/volumes/config/sftpgo.json"
SHARED_GROUP = "file-users"

# Public URL prefix for both WebDAV and the web client UI.
_DAV_PREFIX = "/files"


def write_sftpgo_loaddata(accounts: dict[str, str] | None = None, env: dict | None = None) -> str:
    """Generate loaddata.json: shared folder + local users from accounts/accounts.env."""
    if accounts is None:
        accounts = read_accounts_env()
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

    for username, password in sorted(accounts.items()):
        ensure_user_home(username, puid, pgid)
        # Create an empty hidden directory to serve as the user's isolated home root.
        # This keeps the root directory "/" clean.
        home_root_dir = f"{_USERS_HOME_PREFIX}.home_{username}"
        os.makedirs(home_root_dir.replace("/srv/sftpgo/storage/", "./storage/"), exist_ok=True)
        
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
                "permissions": {"/": ["*"]},
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
    return CONFIG_PATH


def sync_sftpgo_from_accounts(*, recreate: bool = True) -> None:
    """Regenerate loaddata from accounts.env and optionally recreate SFTPGo."""
    accounts = read_accounts_env()
    path = write_sftpgo_loaddata(accounts)
    ok(f"Wrote SFTPGo loaddata ({len(accounts)} user(s)) → {path}")
    if recreate and accounts:
        compose_up("sftpgo", force_recreate=True, check=False)
        ok("Recreated sftpgo to load local WebDAV users")


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
        accounts = read_accounts_env()
        write_sftpgo_loaddata(accounts, env=env)
        write_sftpgo_config()
        ok(f"Wrote SFTPGo config (WebDAV+HTTPD prefix: {_DAV_PREFIX})")
        if accounts:
            ok(
                f"WebDAV users from {ACCOUNTS_ENV} "
                f"({len(accounts)}): {', '.join(sorted(accounts))}"
            )
        else:
            warn(
                f"No accounts in {ACCOUNTS_ENV} yet — "
                "run Samba setup (same file feeds WebDAV)"
            )
        info("WebDAV / = private home; /shared = storage/shared")
        info("Password = Samba file password (≠ Authentik)")


service = SftpgoService()
