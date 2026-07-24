"""Minimal stubs for authentik.core.models (IDE / type-check only)."""

from __future__ import annotations

from enum import Enum
from typing import Any

class UserTypes(Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    SERVICE_ACCOUNT = "service_account"
    INTERNAL_SERVICE_ACCOUNT = "internal_service_account"

class User:
    username: str | None
    type: UserTypes | Any

    def set_password(self, raw_password: str | None, **kwargs: Any) -> None: ...
