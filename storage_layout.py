"""Shared helpers for ./storage/users and ./storage/shared."""
from __future__ import annotations

import os


USERS_ROOT = "./storage/users"
SHARED_ROOT = "./storage/shared"


def ensure_storage_layout(puid: int, pgid: int) -> None:
    """Create users/ + shared/."""
    os.makedirs("./storage", mode=0o755, exist_ok=True)
    os.makedirs(USERS_ROOT, mode=0o755, exist_ok=True)
    os.makedirs(SHARED_ROOT, mode=0o2775, exist_ok=True)
    try:
        os.chown("./storage", puid, pgid)
        os.chown(USERS_ROOT, puid, pgid)
        os.chown(SHARED_ROOT, puid, pgid)
        os.chmod(SHARED_ROOT, 0o2775)
    except OSError:
        pass


def list_storage_usernames() -> list[str]:
    if not os.path.isdir(USERS_ROOT):
        return []
    names: list[str] = []
    for name in sorted(os.listdir(USERS_ROOT)):
        path = os.path.join(USERS_ROOT, name)
        if os.path.isdir(path) and not os.path.islink(path):
            names.append(name)
    return names


def ensure_user_home(username: str, puid: int, pgid: int) -> str:
    """Create private home only. Shared is a separate tree (Samba share / WebDAV vfolder)."""
    home = os.path.join(USERS_ROOT, username)
    os.makedirs(home, mode=0o700, exist_ok=True)
    try:
        os.chown(home, puid, pgid)
        os.chmod(home, 0o700)
    except OSError:
        pass
    return home


def ensure_all_user_homes(puid: int, pgid: int) -> None:
    for name in list_storage_usernames():
        ensure_user_home(name, puid, pgid)
