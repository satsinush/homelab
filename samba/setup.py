"""Samba service — local passdb users + ./storage/users + ./storage/shared."""
from __future__ import annotations

import os

from setup.file_accounts import read_accounts_json
from setup.service import Service, VolumeDir
from setup.storage_layout import (
    USERS_ROOT,
    ensure_all_user_homes,
    ensure_storage_layout,
    ensure_user_home,
)
from setup.ui import info, ok, section, warn


def sync_samba_accounts(env: dict, users: list[dict]) -> None:
    puid = str(env.get("PUID") or os.environ.get("PUID") or "1000")
    pgid = str(env.get("PGID") or os.environ.get("PGID") or "1000")

    # Accounts are created lazily on first dashboard login — no backfill needed here.
    for user_obj in users:
        ensure_user_home(user_obj["username"], int(puid), int(pgid))

    # Note: Samba users are provisioned into the container database at startup
    # by mounting accounts.env (or now a generated accounts.env format if needed
    # by samba/entrypoint.sh, or we can write a compat accounts.env for Samba to read).
    #
    # Let's write the legacy accounts.env format file just for Samba's entrypoint compatibility
    # so we don't have to rebuild the Samba container image or entrypoint script.
    compat_lines = [
        "# Compatibility accounts.env file generated from accounts.json.",
        "# Managed automatically by setup scripts — do not edit."
    ]
    for user_obj in sorted(users, key=lambda u: u["username"]):
        compat_lines.append(f"ACCOUNT_{user_obj['username']}={user_obj['password']}")
    
    compat_path = "./samba/volumes/config/accounts.env"
    with open(compat_path, "w", encoding="utf-8") as f:
        f.write("\n".join(compat_lines) + "\n")
    os.chmod(compat_path, 0o600)


class SambaService(Service):
    name = "samba"
    volume_dirs = [
        VolumeDir("./samba/volumes/data", mode=0o755),
        VolumeDir("./samba/volumes/data/private", mode=0o700),
        VolumeDir("./samba/volumes/data/lock", mode=0o755),
        VolumeDir("./samba/volumes/config", mode=0o700),
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

        users = read_accounts_json()
        sync_samba_accounts(env, users)

        if users:
            ok(f"{len(users)} account(s) synced to Samba")
        else:
            warn("No users yet")
        info(f"SMB private: \\\\<IP>\\<username>  → {USERS_ROOT}/<username>")
        info("SMB shared:  \\\\<IP>\\shared      → ./storage/shared")

    def sync_accounts(self, env: dict, users: list[dict]) -> bool:
        sync_samba_accounts(env, users)
        return True


service = SambaService()
