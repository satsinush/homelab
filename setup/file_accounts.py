"""Shared Samba/SFTPGo account file helpers (./volumes/file-accounts/accounts.env)."""
from __future__ import annotations

import os
import re

ACCOUNTS_ENV = "./volumes/file-accounts/accounts.env"


def safe_username(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "", name.strip())
    if not cleaned:
        raise ValueError("empty username")
    return cleaned


def read_accounts_env(path: str = ACCOUNTS_ENV) -> dict[str, tuple[str, str, str]]:
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


def write_accounts_env(
    accounts: dict[str, tuple[str, str, str]],
    path: str = ACCOUNTS_ENV,
) -> None:
    """Write ACCOUNT_/UID_/GROUPS_ for Samba + SFTPGo (same file)."""
    parent = os.path.dirname(path)
    os.makedirs(parent, mode=0o700, exist_ok=True)
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass
    lines = [
        "# File access accounts for Samba (SMB) and SFTPGo (WebDAV).",
        "# Shared source of truth — managed by samba/setup.py and the dashboard.",
        "# Usernames should match Authentik; password is local (≠ Authentik SSO).",
    ]
    for username in sorted(accounts):
        password, uid, gid = accounts[username]
        lines.append(f"ACCOUNT_{username}={password}")
        lines.append(f"UID_{username}={uid}")
        lines.append(f"GROUPS_{username}={gid}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(path, 0o600)
