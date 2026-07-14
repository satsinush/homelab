"""Restic cloud backup — prompt for S3 credentials and initialize repository."""
from __future__ import annotations

import os
import shutil

from restic_backup import (
    ensure_restic_secrets,
    restic_env,
    run_restic,
    secrets_complete,
)
from service import Service


def _ensure_exclude_file() -> None:
    if os.path.isfile(".backup_exclude"):
        return
    if os.path.isfile(".backup_exclude.example"):
        shutil.copy(".backup_exclude.example", ".backup_exclude")
        print("   ✅ Created .backup_exclude from .backup_exclude.example")


def _maybe_init_repository() -> None:
    if not shutil.which("restic"):
        print("   ⚠️  restic not installed; skip repository init.")
        print("   Install restic, then re-run: python3 setup.py setup")
        return

    env = restic_env(prompt=False)
    # Already initialized?
    if run_restic(["cat", "config"], env=env, quiet=True) == 0:
        print("   ✅ Restic repository already initialized")
        return

    print("   Initializing Restic repository...")
    code = run_restic(["init"], env=env)
    if code == 0:
        print("   ✅ Restic repository initialized")
    else:
        print("   ⚠️  restic init failed. Check credentials / bucket and run again.")


class ResticService(Service):
    name = "restic"
    volume_dirs = []

    def setup(self, env: dict) -> None:
        print("\n☁️  Configuring Restic cloud backup...")
        os.makedirs("./volumes/secrets", exist_ok=True)
        os.chmod("./volumes/secrets", 0o700)

        if secrets_complete():
            print("   ✅ Restic secrets already present; skipping prompts")
            _ensure_exclude_file()
            return

        if not ensure_restic_secrets(allow_skip=True, confirm_password=True):
            return

        _ensure_exclude_file()
        _maybe_init_repository()


service = ResticService()
