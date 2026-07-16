"""Samba service — local passdb users + ./storage/users + ./storage/shared."""
from __future__ import annotations

import os
import re
import secrets as pysecrets

from service import Service, VolumeDir
from setup_utils import prompt_nonempty, prompt_password, prompt_yes_no
from storage_layout import (
    USERS_ROOT,
    ensure_all_user_homes,
    ensure_storage_layout,
    ensure_user_home,
)


def _safe_username(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "", name.strip())
    if not cleaned:
        raise ValueError("empty username")
    return cleaned


def _read_accounts_env(path: str) -> dict[str, tuple[str, str, str]]:
    """Parse accounts.env → username -> (password, uid, gid)."""
    accounts: dict[str, tuple[str, str, str]] = {}
    if not os.path.isfile(path):
        return accounts
    passwords: dict[str, str] = {}
    uids: dict[str, str] = {}
    gids: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.startswith("ACCOUNT_"):
                passwords[key[len("ACCOUNT_") :]] = value
            elif key.startswith("UID_"):
                uids[key[len("UID_") :]] = value
            elif key.startswith("GROUPS_"):
                gids[key[len("GROUPS_") :]] = value
    for username, password in passwords.items():
        accounts[username] = (
            password,
            uids.get(username, "1000"),
            gids.get(username, "1000"),
        )
    return accounts


def _write_accounts_env(path: str, accounts: dict[str, tuple[str, str, str]]) -> None:
    """Write ACCOUNT_/UID_/GROUPS_ lines for servercontainers/samba."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lines = [
        "# Samba local accounts (SMB password ≠ Authentik).",
        "# Managed by samba/setup.py — usernames should match Authentik.",
    ]
    for username in sorted(accounts):
        password, uid, gid = accounts[username]
        lines.append(f"ACCOUNT_{username}={password}")
        lines.append(f"UID_{username}={uid}")
        lines.append(f"GROUPS_{username}={gid}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(path, 0o600)


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
        # Empty bind mount replaces image /var/lib/samba; ensure private/ for msg.sock
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

        accounts_path = "./samba/volumes/config/accounts.env"
        accounts = _read_accounts_env(accounts_path)
        print("   Create local Samba user(s). Usernames should match Authentik.")
        print("   New Authentik users do NOT auto-create Samba accounts.")
        if accounts:
            print(f"   ✅ Existing Samba users: {', '.join(sorted(accounts))}")
            print("   ℹ️  SMB passwords are separate from Authentik.")

        default_user = (env.get("HOMELAB_USERNAME") or "").strip()
        created = 0
        while True:
            if not accounts and default_user and default_user not in accounts:
                username = default_user
                print(f"   Default username: {username}")
            else:
                if not prompt_yes_no(
                    "   Add a Samba user? (y/N): "
                    if accounts or created
                    else "   Create a Samba user? (Y/n): ",
                    default=bool(not accounts and not created),
                ):
                    break
                username = prompt_nonempty("   Samba username: ")
            try:
                username = _safe_username(username)
            except ValueError:
                print("   ⚠️  Invalid username; try again")
                continue
            if username in accounts:
                print(
                    f"   ⚠️  User {username!r} already exists — "
                    "skipping (edit accounts.env to change password)"
                )
                if not prompt_yes_no("   Add another Samba user? (y/N): ", default=False):
                    break
                continue
            password = prompt_password(f"   SMB password for {username}: ", confirm=True)
            if not password:
                password = pysecrets.token_urlsafe(16)
                print(f"   ℹ️  Generated password for {username} (store it somewhere safe)")
            ensure_user_home(username, int(puid), int(pgid))
            accounts[username] = (password, puid, pgid)
            created += 1
            if not prompt_yes_no("   Add another Samba user? (y/N): ", default=False):
                break

        # Ensure private homes for everyone already in accounts.env
        for username in accounts:
            ensure_user_home(username, int(puid), int(pgid))

        _write_accounts_env(accounts_path, accounts)
        if created:
            print(f"   ✅ Added {created} Samba account(s) → {accounts_path}")
            print(
                "   ℹ️  Recreate Samba to load new users: "
                "docker compose up -d --force-recreate samba"
            )
        elif accounts:
            print(f"   ✅ {len(accounts)} Samba account(s) in {accounts_path}")
        else:
            print(
                "   ⚠️  No Samba users yet; re-run setup or edit "
                "samba/volumes/config/accounts.env"
            )
        print(f"   ℹ️  Private: \\\\<IP>\\<username>  → {USERS_ROOT}/<username>")
        print("   ℹ️  Shared:  \\\\<IP>\\shared      → ./storage/shared")
        print("   ℹ️  SMB password ≠ Authentik password")


service = SambaService()
