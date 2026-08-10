"""Restic cloud backup — prompt for S3 credentials and initialize repository."""
from __future__ import annotations

import os
import shutil

from setup.restic_backup import (
    ensure_restic_repository,
    ensure_restic_secrets,
    secrets_complete,
)
from setup.service import Service
from setup.ui import ok, section


def _ensure_exclude_file() -> None:
    if os.path.isfile(".backup_exclude"):
        return
    if os.path.isfile(".backup_exclude.example"):
        shutil.copy(".backup_exclude.example", ".backup_exclude")
        ok("Created .backup_exclude from .backup_exclude.example")


class ResticService(Service):
    name = "restic"
    volume_dirs = []

    def setup(self, env: dict) -> None:
        section("Configuring Restic cloud backup...", emoji="☁️")
        os.makedirs("./volumes/secrets", exist_ok=True)
        os.chmod("./volumes/secrets", 0o700)

        if secrets_complete():
            ok("Restic secrets already present; skipping prompts")
            _ensure_exclude_file()
            ensure_restic_repository(require_binary=False)
            return

        if not ensure_restic_secrets(allow_skip=True, confirm_password=True):
            return

        _ensure_exclude_file()
        ensure_restic_repository(require_binary=False)


service = ResticService()
