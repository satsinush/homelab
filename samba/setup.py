"""Samba service — local passdb users + ./storage/users + ./storage/shared."""
from __future__ import annotations

import os
import secrets as pysecrets

from file_accounts import (
    ACCOUNTS_ENV,
    read_accounts_env,
    safe_username,
    write_accounts_env,
)
from service import Service, VolumeDir
from setup_utils import prompt_nonempty, prompt_password, prompt_yes_no
from storage_layout import (
    USERS_ROOT,
    ensure_all_user_homes,
    ensure_storage_layout,
    ensure_user_home,
)


class SambaService(Service):
    name = "samba"
    volume_dirs = [
        VolumeDir("./samba/volumes/config", mode=0o700),
        VolumeDir("./samba/volumes/data", mode=0o755),
        VolumeDir("./samba/volumes/data/private", mode=0o700),
        VolumeDir("./samba/volumes/data/lock", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n📁 Preparing Samba + shared storage...")
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
        print("   Create file-access user(s) for Samba + WebDAV.")
        print("   Usernames should match Authentik; password is local (≠ SSO).")
        if accounts:
            print(f"   ✅ Existing users: {', '.join(sorted(accounts))}")

        default_user = (env.get("HOMELAB_USERNAME") or "").strip()
        created = 0
        while True:
            if not accounts and default_user and default_user not in accounts:
                username = default_user
                print(f"   Default username: {username}")
            else:
                if not prompt_yes_no(
                    "   Add a file-access user? (y/N): "
                    if accounts or created
                    else "   Create a file-access user? (Y/n): ",
                    default=bool(not accounts and not created),
                ):
                    break
                username = prompt_nonempty("   Username: ")
            try:
                username = safe_username(username)
            except ValueError:
                print("   ⚠️  Invalid username; try again")
                continue
            if username in accounts:
                print(
                    f"   ⚠️  User {username!r} already exists — "
                    "skipping (edit accounts.env to change password)"
                )
                if not prompt_yes_no("   Add another user? (y/N): ", default=False):
                    break
                continue
            password = prompt_password(
                f"   SMB/WebDAV password for {username}: ", confirm=True
            )
            if not password:
                password = pysecrets.token_urlsafe(16)
                print(f"   ℹ️  Generated password for {username} (store it somewhere safe)")
            ensure_user_home(username, int(puid), int(pgid))
            accounts[username] = (password, puid, pgid)
            created += 1
            if not prompt_yes_no("   Add another user? (y/N): ", default=False):
                break

        for username in accounts:
            ensure_user_home(username, int(puid), int(pgid))

        write_accounts_env(accounts, ACCOUNTS_ENV)

        # Keep SFTPGo loaddata in sync (no recreate during initial setup — compose up later).
        from sftpgo.setup import write_sftpgo_loaddata

        write_sftpgo_loaddata(accounts)

        if created:
            print(f"   ✅ Added {created} account(s) → {ACCOUNTS_ENV}")
            print(
                "   ℹ️  Recreate after setup if already running: "
                "docker compose up -d --force-recreate samba sftpgo"
            )
        elif accounts:
            print(f"   ✅ {len(accounts)} account(s) in {ACCOUNTS_ENV}")
        else:
            print(f"   ⚠️  No users yet; re-run setup or edit {ACCOUNTS_ENV}")
        print(f"   ℹ️  SMB private: \\\\<IP>\\<username>  → {USERS_ROOT}/<username>")
        print("   ℹ️  SMB shared:  \\\\<IP>\\shared      → ./storage/shared")
        print("   ℹ️  WebDAV: https://dav.<hostname>/  (same password)")
        print("   ℹ️  File password ≠ Authentik password")


service = SambaService()
