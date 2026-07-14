"""Restic cloud backup helpers (Backblaze B2 / S3-compatible)."""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
import sys


SECRET_NAMES = {
    "repository": "restic_repository",
    "password": "restic_password",
    "key_id": "restic_aws_access_key_id",
    "app_key": "restic_aws_secret_access_key",
}


def _read_secret(name: str) -> str:
    path = f"./volumes/secrets/{name}"
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def write_secret(name: str, value: str) -> None:
    """Write a secret file under volumes/secrets/ with mode 0600."""
    os.makedirs("./volumes/secrets", exist_ok=True)
    path = f"./volumes/secrets/{name}"
    with open(path, "w", encoding="utf-8") as f:
        f.write(value.strip() + "\n")
    os.chmod(path, 0o600)


def secrets_complete() -> bool:
    """True when all restic_* credential files are non-empty."""
    return all(_read_secret(name) for name in SECRET_NAMES.values())


def missing_secrets() -> list[str]:
    return [name for name in SECRET_NAMES.values() if not _read_secret(name)]


def restic_env() -> dict[str, str]:
    """Build environment for restic from volumes/secrets."""
    repo = _read_secret(SECRET_NAMES["repository"])
    password = _read_secret(SECRET_NAMES["password"])
    key_id = _read_secret(SECRET_NAMES["key_id"])
    app_key = _read_secret(SECRET_NAMES["app_key"])

    missing = missing_secrets()
    if missing:
        print("❌ Missing Restic secrets in volumes/secrets/:")
        for name in missing:
            print(f"   - {name}")
        print("   Run: python3 setup.py setup  (or configure restic when prompted)")
        sys.exit(1)

    env = os.environ.copy()
    env["RESTIC_REPOSITORY"] = repo
    env["RESTIC_PASSWORD"] = password
    env["AWS_ACCESS_KEY_ID"] = key_id
    env["AWS_SECRET_ACCESS_KEY"] = app_key
    return env


def _exclude_file() -> str | None:
    if os.path.isfile(".backup_exclude"):
        return ".backup_exclude"
    if os.path.isfile(".backup_exclude.example"):
        return ".backup_exclude.example"
    return None


def backup_targets() -> list[str]:
    targets: list[str] = []
    if os.path.isfile(".env"):
        targets.append(".env")
    if os.path.isdir("volumes"):
        targets.append("volumes")
    for path in sorted(glob.glob("*/volumes")):
        if os.path.isdir(path):
            targets.append(path)
    return targets


def run_restic(
    args: list[str],
    env: dict[str, str] | None = None,
    *,
    require_binary: bool = True,
    quiet: bool = False,
) -> int:
    if not shutil.which("restic"):
        if require_binary:
            print("❌ restic is not installed. Install it and try again.")
            sys.exit(1)
        return 127
    env = env or restic_env()
    if not quiet:
        print(f"   $ restic {' '.join(args)}")
    proc = subprocess.run(
        ["restic", *args],
        env=env,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
    )
    return proc.returncode


def restic_backup(*, auto: bool = False) -> None:
    env = restic_env()
    targets = backup_targets()
    if not targets:
        print("⚠️  No backup targets found (.env / volumes / */volumes)")
        return

    print("\n☁️  Streaming encrypted snapshot to Restic repository...")
    print(f"   Targets: {', '.join(targets)}")
    cmd = ["backup", *targets]
    exclude = _exclude_file()
    if exclude:
        cmd.extend(["--exclude-file", exclude])
        print(f"   Exclude file: {exclude}")

    code = run_restic(cmd, env=env)
    if code != 0:
        print(f"❌ restic backup failed (exit {code})")
        sys.exit(code)

    print("\n🧹 Enforcing retention policy...")
    forget = [
        "forget",
        "--keep-daily", "7",
        "--keep-weekly", "4",
        "--keep-monthly", "12",
        "--prune",
    ]
    code = run_restic(forget, env=env)
    if code != 0:
        print(f"❌ restic forget/prune failed (exit {code})")
        sys.exit(code)

    print("✅ Cloud backup completed successfully")


def restic_restore(snapshot: str = "latest") -> None:
    env = restic_env()
    print(f"\n☁️  Restoring Restic snapshot '{snapshot}' into repo root...")
    code = run_restic(
        ["restore", snapshot, "--target", "."],
        env=env,
    )
    if code != 0:
        print(f"❌ restic restore failed (exit {code})")
        sys.exit(code)
    print("✅ Cloud restore of files completed")
