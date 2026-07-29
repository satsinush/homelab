"""Sync Authentik password changes into Samba NTLM passdb via host-api.

Only ``homelab-admins`` get SMB accounts. Hooks ``password_changed``, which
Authentik emits from ``User.set_password`` with the cleartext password —
including Admin → Users → set password.
"""

from __future__ import annotations

import os

import requests
from django.dispatch import receiver
from structlog.stdlib import get_logger

from authentik.core.models import User, UserTypes
from authentik.core.signals import password_changed

LOGGER = get_logger()

_SKIP_USERNAMES = frozenset({"ldapservice", "akadmin", "AnonymousUser"})
_SMB_ADMIN_GROUP = "homelab-admins"


def _host_api_url() -> str:
    return (os.environ.get("HOST_API_URL") or "http://host.docker.internal:5001").rstrip("/")


def _host_api_token() -> str:
    try:
        with open("/run/secrets/host_api_token", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def _is_smb_admin(user: User) -> bool:
    try:
        # Prefer User.groups (ak_groups is deprecated in newer Authentik).
        groups = getattr(user, "groups", None) or getattr(user, "ak_groups", None)
        if groups is None:
            return False
        return groups.filter(name=_SMB_ADMIN_GROUP).exists()
    except Exception:
        return False


def _post_smb(path: str, payload: dict, username: str) -> None:
    token = _host_api_token()
    if not token:
        LOGGER.warning("smb sync skipped: host_api_token missing")
        return
    url = f"{_host_api_url()}{path}"
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if resp.status_code >= 400:
            LOGGER.warning(
                "smb sync failed",
                path=path,
                username=username,
                status=resp.status_code,
                body=resp.text[:200],
            )
        else:
            LOGGER.info("smb sync ok", path=path, username=username)
    except Exception as exc:
        # Never block Authentik password changes on SMB failures.
        LOGGER.warning("smb sync error", path=path, username=username, error=str(exc))


@receiver(password_changed)
def sync_smb_password(sender, user: User, password: str | None = None, **_):
    if not user:
        return
    username = (user.username or "").strip()
    if not username or username in _SKIP_USERNAMES:
        return
    if getattr(user, "type", None) in (
        UserTypes.SERVICE_ACCOUNT,
        UserTypes.INTERNAL_SERVICE_ACCOUNT,
    ):
        return

    if not _is_smb_admin(user):
        # Drop any leftover Samba account for non-admins.
        _post_smb("/smb/disable-user", {"username": username}, username)
        return

    if not password:
        return

    _post_smb(
        "/smb/set-password",
        {"username": username, "password": password},
        username,
    )
