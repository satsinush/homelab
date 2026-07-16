"""SFTPGo WebDAV — volumes + LDAP bind secret (Authentik LDAP outpost)."""
from __future__ import annotations

import os
import sqlite3

from service import Service, VolumeDir
from setup_utils import gen_secret
from storage_layout import ensure_all_user_homes, ensure_storage_layout


_LEGACY_HOME_PREFIX = "/srv/sftpgo/homes/"
_USERS_HOME_PREFIX = "/srv/sftpgo/storage/users/"


def _migrate_legacy_home_dirs() -> None:
    """Point LDAP-created users still on /homes at /storage/users."""
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


class SftpgoService(Service):
    name = "sftpgo"
    volume_dirs = [
        VolumeDir("./sftpgo/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n📂 Preparing SFTPGo / WebDAV...")
        puid = int(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = int(env.get("PGID") or os.environ.get("PGID") or "1000")
        ensure_storage_layout(puid, pgid)
        ensure_all_user_homes(puid, pgid)
        _migrate_legacy_home_dirs()
        # Shared with Authentik blueprint: cn=ldapservice bind password
        gen_secret("ldap_bind_password", 32)
        print("   ✅ SFTPGo volumes + ldap_bind_password ready")
        print("   ℹ️  WebDAV / = storage/users/<user>  (private)")
        print("   ℹ️  WebDAV /shared = storage/shared (Authentik homelab-* group)")
        print("   ℹ️  Obsidian Remotely Save: https://dav.<hostname>/ (Authentik password)")


service = SftpgoService()
