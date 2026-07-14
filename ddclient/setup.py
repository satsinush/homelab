"""ddclient service — config bind is the gitignored ddclient.conf."""
from __future__ import annotations

from service import Service


class DdclientService(Service):
    name = "ddclient"
    volume_dirs = []


service = DdclientService()
