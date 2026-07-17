"""Restic cloud backup — prompt for S3 credentials and initialize repository."""
from __future__ import annotations

import os
import shutil

from setup.restic_backup import (
    ensure_restic_secrets,
    restic_env,
    run_restic,
    secrets_complete,
)
from setup.service import Service
from setup.ui import ok, section, step, warn


def _ensure_exclude_file() -> None:
    if os.path.isfile(".backup_exclude"):
        return
    if os.path.isfile(".backup_exclude.example"):
        shutil.copy(".backup_exclude.example", ".backup_exclude")
        ok("Created .backup_exclude from .backup_exclude.example")


def _maybe_init_repository() -> None:
    if not shutil.which("restic"):
        warn("restic not installed; skip repository init.")
        step("Install restic, then re-run: python3 setup.py setup")
        return

    env = restic_env(prompt=False)
    # Already initialized?
    if run_restic(["cat", "config"], env=env, quiet=True) == 0:
        ok("Restic repository already initialized")
        return

    step("Initializing Restic repository...")
    code = run_restic(["init"], env=env)
    if code == 0:
        ok("Restic repository initialized")
    else:
        warn("restic init failed. Check credentials / bucket and run again.")


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
            return

        if not ensure_restic_secrets(allow_skip=True, confirm_password=True):
            return

        _ensure_exclude_file()
        _maybe_init_repository()


service = ResticService()
