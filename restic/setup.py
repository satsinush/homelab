"""Restic cloud backup — prompt for S3 credentials and initialize repository."""
from __future__ import annotations

import getpass
import os
import shutil

from restic_backup import (
    SECRET_NAMES,
    restic_env,
    run_restic,
    secrets_complete,
    write_secret,
)
from service import Service


def _prompt_nonempty(label: str) -> str:
    while True:
        value = input(label).strip()
        if value:
            return value
        print("   ⚠️  Value required.")


def _prompt_password() -> str:
    while True:
        password = getpass.getpass("   Restic encryption password (store offline too): ").strip()
        if len(password) < 12:
            print("   ⚠️  Use at least 12 characters.")
            continue
        confirm = getpass.getpass("   Confirm Restic encryption password: ").strip()
        if password != confirm:
            print("   ⚠️  Passwords do not match. Try again.")
            continue
        return password


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

    env = restic_env()
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

        print("   Offsite backups use Restic over S3-compatible storage (e.g. Backblaze B2 / Cloudflare R2).")
        print("   Create a private bucket and application key before continuing.")
        while True:
            answer = input("   Configure cloud backup now? (y/n): ").strip().lower()
            if answer in ("y", "n"):
                break
            print("   ⚠️  Please answer with y or n.")

        if answer == "n":
            print("   ℹ️  Skipped. You can re-run setup later to add Restic credentials.")
            return

        print("\n   Repository URL example:")
        print("     s3:s3.us-east-005.backblazeb2.com/your-bucket-name")
        repository = _prompt_nonempty("   RESTIC repository URL: ")
        password = _prompt_password()
        key_id = _prompt_nonempty("   S3 access key id: ")
        app_key = getpass.getpass("   S3 secret access key: ").strip()
        while not app_key:
            print("   ⚠️  Value required.")
            app_key = getpass.getpass("   S3 secret access key: ").strip()

        write_secret(SECRET_NAMES["repository"], repository)
        write_secret(SECRET_NAMES["password"], password)
        write_secret(SECRET_NAMES["key_id"], key_id)
        write_secret(SECRET_NAMES["app_key"], app_key)
        print("   ✅ Wrote restic_* secrets under volumes/secrets/")

        _ensure_exclude_file()
        _maybe_init_repository()


service = ResticService()
