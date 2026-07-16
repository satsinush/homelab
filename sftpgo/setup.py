"""SFTPGo WebDAV — local users from Samba accounts.env (no Authentik LDAP)."""
from __future__ import annotations

import json
import os
import sqlite3

from file_accounts import ACCOUNTS_ENV, read_accounts_env
from service import Service, VolumeDir
from storage_layout import ensure_all_user_homes, ensure_storage_layout, ensure_user_home
from setup_utils import run_cmd

_LEGACY_HOME_PREFIX = "/srv/sftpgo/homes/"
_USERS_HOME_PREFIX = "/srv/sftpgo/storage/users/"
LOADDATA_PATH = "./sftpgo/volumes/config/loaddata.json"
SHARED_GROUP = "file-users"


def _migrate_legacy_home_dirs() -> None:
    db_path = "./sftpgo/volumes/data/sftpgo.db"
    if not os.path.isfile(db_path):
        return
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        cur.execute(
            "SELECT id, username, home_dir FROM users WHERE home_dir LIKE ?",
            (_LEGACY_HOME_PREFIX + "%",),
        )
        rows = cur.fetchall()
        for user_id, username, _home in rows:
            new_home = _USERS_HOME_PREFIX + username
            cur.execute(
                "UPDATE users SET home_dir = ? WHERE id = ?",
                (new_home, user_id),
            )
            print(f"   ✅ Migrated SFTPGo home for {username!r} → {new_home}")
        con.commit()
        con.close()
    except sqlite3.Error as exc:
        print(f"   ⚠️  Could not migrate SFTPGo home dirs: {exc}")


def write_sftpgo_loaddata(accounts: dict[str, tuple[str, str, str]] | None = None) -> str:
    """Generate loaddata.json: shared folder + local users from accounts.env."""
    if accounts is None:
        accounts = read_accounts_env()
    puid = int(os.environ.get("PUID") or "1000")
    pgid = int(os.environ.get("PGID") or "1000")

    users = []
    for username, (password, _uid, _gid) in sorted(accounts.items()):
        ensure_user_home(username, puid, pgid)
        users.append(
            {
                "status": 1,
                "username": username,
                "password": password,
                "home_dir": f"{_USERS_HOME_PREFIX}{username}",
                "permissions": {"/": ["*"]},
                "groups": [{"name": SHARED_GROUP, "type": 2}],
            }
        )

    payload = {
        "users": users,
        "folders": [
            {
                "name": "shared",
                "mapped_path": "/srv/sftpgo/storage/shared",
                "description": "Shared storage for all file-access users",
                "filesystem": {"provider": 0},
            }
        ],
        "groups": [
            {
                "name": SHARED_GROUP,
                "description": "All Samba/WebDAV users — /shared virtual folder",
                "virtual_folders": [
                    {
                        "name": "shared",
                        "virtual_path": "/shared",
                        "quota_size": 0,
                        "quota_files": 0,
                    }
                ],
            }
        ],
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


def sync_sftpgo_from_accounts(*, recreate: bool = True) -> None:
    """Regenerate loaddata from accounts.env and optionally recreate SFTPGo."""
    accounts = read_accounts_env()
    path = write_sftpgo_loaddata(accounts)
    print(f"   ✅ Wrote SFTPGo loaddata ({len(accounts)} user(s)) → {path}")
    if recreate and accounts:
        run_cmd(
            "docker compose up -d --force-recreate sftpgo",
            check=False,
        )
        print("   ✅ Recreated sftpgo to load local WebDAV users")


class SftpgoService(Service):
    name = "sftpgo"
    volume_dirs = [
        VolumeDir("./sftpgo/volumes/data", mode=0o755),
        VolumeDir("./sftpgo/volumes/config", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n📂 Preparing SFTPGo / WebDAV...")
        puid = int(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = int(env.get("PGID") or os.environ.get("PGID") or "1000")
        ensure_storage_layout(puid, pgid)
        ensure_all_user_homes(puid, pgid)
        _migrate_legacy_home_dirs()
        accounts = read_accounts_env()
        write_sftpgo_loaddata(accounts)
        if accounts:
            print(
                f"   ✅ WebDAV users from {ACCOUNTS_ENV} "
                f"({len(accounts)}): {', '.join(sorted(accounts))}"
            )
        else:
            print(
                f"   ⚠️  No accounts in {ACCOUNTS_ENV} yet — "
                "run Samba setup (same file feeds WebDAV)"
            )
        print("   ℹ️  WebDAV / = private home; /shared = storage/shared")
        print("   ℹ️  Password = Samba file password (≠ Authentik)")


service = SftpgoService()
