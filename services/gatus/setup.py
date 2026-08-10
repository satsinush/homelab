"""Gatus service — config is git-tracked; no bind volumes."""
from __future__ import annotations

from setup.service import Service


class GatusService(Service):
    name = "gatus"
    volume_dirs = []


service = GatusService()
