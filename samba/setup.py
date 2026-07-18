"""Samba service — local passdb users + ./storage/users + ./storage/shared."""
from __future__ import annotations

import os
import secrets as pysecrets

from setup.file_accounts import (
    ACCOUNTS_ENV,
    read_accounts_env,
    safe_username,
    write_accounts_env,
)
from setup.service import Service, VolumeDir
from setup.storage_layout import (
    USERS_ROOT,
    ensure_all_user_homes,
    ensure_storage_layout,
    ensure_user_home,
)
from setup.ui import info, ok, section, step, warn
from setup.utils import prompt_nonempty, prompt_password, prompt_yes_no


class SambaService(Service):
    name = "samba"
    volume_dirs = [
        VolumeDir("./samba/volumes/data", mode=0o755),
        VolumeDir("./samba/volumes/data/private", mode=0o700),
        VolumeDir("./samba/volumes/data/lock", mode=0o755),
        VolumeDir("./volumes/accounts", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Samba + shared storage...", emoji="📁")
        private = "./samba/volumes/data/private"
        os.makedirs(private, mode=0o700, exist_ok=True)
        try:
            os.chmod(private, 0o700)
        except OSError:
            pass
        puid = str(env.get("PUID") or os.environ.get("PUID") or "1000")
        pgid = str(env.get("PGID") or os.environ.get("PGID") or "1000")
        ensure_storage_layout(int(puid), int(pgid))
        ensure_all_user_homes(int(puid), int(pgid))

        accounts = read_accounts_env(ACCOUNTS_ENV)
        default_user = (env.get("HOMELAB_USERNAME") or "").strip()
        
        if default_user:
            default_user = default_user.lower()
            if default_user not in accounts:
                pw_path = "./volumes/secrets/homelab_password"
                if os.path.isfile(pw_path):
                    with open(pw_path, encoding="utf-8") as f:
                        default_pw = f.read().strip()
                    if default_pw:
                        accounts[default_user] = default_pw
                        step(f"Auto-registered default admin user: {default_user}")

        for username in accounts:
            ensure_user_home(username, int(puid), int(pgid))

        write_accounts_env(accounts, ACCOUNTS_ENV)

        # Keep SFTPGo loaddata in sync (no recreate during initial setup — compose up later).
        from sftpgo.setup import write_sftpgo_loaddata

        write_sftpgo_loaddata(accounts)

        if accounts:
            ok(f"{len(accounts)} account(s) in {ACCOUNTS_ENV}")
        else:
            warn(f"No users yet; re-run setup or edit {ACCOUNTS_ENV}")
        info(f"SMB private: \\\\<IP>\\<username>  → {USERS_ROOT}/<username>")
        info("SMB shared:  \\\\<IP>\\shared      → ./storage/shared")
        info("WebDAV: https://dav.<hostname>/  (same password)")
        info("File password ≠ Authentik password")


service = SambaService()
