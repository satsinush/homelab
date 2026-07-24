"""Sync Authentik password changes into Samba NTLM passdb via host-api.

Hooks ``password_changed``, which Authentik emits from ``User.set_password``
with the cleartext password — including Admin → Users → set password.
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


def _host_api_url() -> str:
    return (os.environ.get("HOST_API_URL") or "http://host.docker.internal:5001").rstrip("/")


def _host_api_token() -> str:
    try:
        with open("/run/secrets/host_api_token", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


@receiver(password_changed)
def sync_smb_password(sender, user: User, password: str | None = None, **_):
    if not password or not user:
        return
    username = (user.username or "").strip()
    if not username or username in _SKIP_USERNAMES:
        return
    if getattr(user, "type", None) in (
        UserTypes.SERVICE_ACCOUNT,
        UserTypes.INTERNAL_SERVICE_ACCOUNT,
    ):
        return

    token = _host_api_token()
    if not token:
        LOGGER.warning("smb sync skipped: host_api_token missing")
        return

    url = f"{_host_api_url()}/smb/set-password"
    try:
        resp = requests.post(
            url,
            json={"username": username, "password": password},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if resp.status_code >= 400:
            LOGGER.warning(
                "smb sync failed",
                username=username,
                status=resp.status_code,
                body=resp.text[:200],
            )
        else:
            LOGGER.info("smb password synced", username=username)
    except Exception as exc:
        # Never block Authentik password changes on SMB failures.
        LOGGER.warning("smb sync error", username=username, error=str(exc))
