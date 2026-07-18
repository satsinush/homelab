"""Shared Samba/SFTPGo account file helpers (./volumes/accounts/accounts.env)."""
from __future__ import annotations

import os
import re

ACCOUNTS_ENV = "./volumes/accounts/accounts.env"


def safe_username(name: str) -> str:
    # Lowercased because the samba image lowercases account names when hashing;
    # keeping one canonical form avoids SMB/WebDAV mismatches.
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "", name.strip()).lower()
    if not cleaned:
        raise ValueError("empty username")
    return cleaned


def read_accounts_env(path: str = ACCOUNTS_ENV) -> dict[str, str]:
    """Parse accounts.env → username -> password."""
    accounts: dict[str, str] = {}
    if not os.path.isfile(path):
        return accounts
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.startswith("ACCOUNT_"):
                accounts[key[len("ACCOUNT_") :]] = value
    return accounts


def write_accounts_env(
    accounts: dict[str, str],
    path: str = ACCOUNTS_ENV,
) -> None:
    """Write ACCOUNT_ lines for Samba + SFTPGo (same file).

    UID_/GROUPS_ are intentionally NOT written: giving every account the same
    uid (PUID) corrupted the samba container's passdb — unix users need unique
    uids. The container auto-assigns them, and the shares force file ownership
    to PUID:PGID instead (see samba/compose.yaml + samba/entrypoint.sh).
    """
    parent = os.path.dirname(path)
    os.makedirs(parent, mode=0o700, exist_ok=True)
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass
    lines = [
        "# User accounts for Samba (SMB), SFTPGo (WebDAV), and Radicale (CalDAV/CardDAV).",
        "# Shared source of truth — managed by setup scripts and the dashboard.",
        "# Usernames should match Authentik; password is local (≠ Authentik SSO).",
    ]
    for username in sorted(accounts):
        lines.append(f"ACCOUNT_{username}={accounts[username]}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(path, 0o600)
