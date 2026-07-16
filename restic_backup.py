"""Restic cloud backup helpers (Backblaze B2 / S3-compatible)."""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
import sys

from setup_utils import prompt_nonempty, prompt_password, prompt_secret, prompt_yes_no


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
        f.write(value.strip())
    os.chmod(path, 0o600)


def secrets_complete() -> bool:
    """True when all restic_* credential files are non-empty."""
    return all(_read_secret(name) for name in SECRET_NAMES.values())


def missing_secrets() -> list[str]:
    return [name for name in SECRET_NAMES.values() if not _read_secret(name)]


def _normalize_repository(repository: str) -> str:
    if repository.startswith("https://") or repository.startswith("http://"):
        repository = f"s3:{repository}"
        print(f"   ℹ️  Prefixed with s3: → {repository}")
    elif not repository.startswith("s3:"):
        print("   ⚠️  Expected a URL starting with s3: (S3-compatible backends).")
    return repository


def ensure_restic_secrets(
    *,
    allow_skip: bool = False,
    confirm_password: bool = True,
) -> bool:
    """Ensure all restic_* secrets exist, prompting for any that are missing.

    Returns False only when allow_skip=True and the user declines.
    """
    os.makedirs("./volumes/secrets", exist_ok=True)
    try:
        os.chmod("./volumes/secrets", 0o700)
    except OSError:
        pass

    if secrets_complete():
        return True

    missing = missing_secrets()
    print("\n☁️  Restic credentials required (volumes/secrets/restic_*).")
    print("   Missing:")
    for name in missing:
        print(f"     - {name}")

    if allow_skip:
        if not prompt_yes_no("   Configure cloud backup credentials now? (y/n): "):
            print("   ℹ️  Skipped. You can re-run setup / backup / restore later.")
            return False

    print("   Offsite backups use Restic over S3-compatible storage (e.g. B2 / Cloudflare R2).")
    print("   Repository URL examples (must include the s3: backend prefix):")
    print("     s3:s3.us-east-005.backblazeb2.com/your-bucket-name")
    print("     s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/your-bucket-name")

    if not _read_secret(SECRET_NAMES["repository"]):
        repository = _normalize_repository(prompt_nonempty("   RESTIC repository URL: "))
        write_secret(SECRET_NAMES["repository"], repository)

    if not _read_secret(SECRET_NAMES["password"]):
        if confirm_password:
            password = prompt_password(
                "   Restic encryption password (store offline too): ",
                confirm=True,
                confirm_label="   Confirm Restic encryption password: ",
                min_length=12,
            )
        else:
            password = prompt_password("   Restic encryption password: ")
        write_secret(SECRET_NAMES["password"], password)

    if not _read_secret(SECRET_NAMES["key_id"]):
        write_secret(SECRET_NAMES["key_id"], prompt_nonempty("   S3 access key id: "))

    if not _read_secret(SECRET_NAMES["app_key"]):
        write_secret(SECRET_NAMES["app_key"], prompt_secret("   S3 secret access key: "))

    print("   ✅ Wrote restic_* secrets under volumes/secrets/")
    return True


def restic_env(*, prompt: bool = True, confirm_password: bool = True) -> dict[str, str]:
    """Build environment for restic from volumes/secrets (prompt if missing)."""
    if not secrets_complete():
        can_prompt = prompt and hasattr(sys.stdin, "isatty") and sys.stdin.isatty()
        if can_prompt:
            ensure_restic_secrets(allow_skip=False, confirm_password=confirm_password)
        if not secrets_complete():
            print("❌ Missing Restic secrets in volumes/secrets/:")
            for name in missing_secrets():
                print(f"   - {name}")
            if not can_prompt:
                print("   Non-interactive mode: provide secrets or run interactively.")
            sys.exit(1)

    env = os.environ.copy()
    env["RESTIC_REPOSITORY"] = _read_secret(SECRET_NAMES["repository"])
    env["RESTIC_PASSWORD"] = _read_secret(SECRET_NAMES["password"])
    env["AWS_ACCESS_KEY_ID"] = _read_secret(SECRET_NAMES["key_id"])
    env["AWS_SECRET_ACCESS_KEY"] = _read_secret(SECRET_NAMES["app_key"])
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
    if os.path.isdir("storage"):
        targets.append("storage")
    for path in sorted(glob.glob("*/volumes")):
        if os.path.isdir(path):
            targets.append(path)
    return targets


def _restic_argv(args: list[str]) -> list[str]:
    """Prefer root for restic so bind-mounted container files are readable/writable.

    systemd backups already run as root; interactive `./setup.py backup` otherwise
    hits permission denied on root/www-data-owned volume files.
    """
    argv = ["restic", *args]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return argv
    if not shutil.which("sudo"):
        return argv
    return [
        "sudo",
        "--preserve-env=RESTIC_REPOSITORY,RESTIC_PASSWORD,AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,AWS_DEFAULT_REGION",
        *argv,
    ]


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
    cmd = _restic_argv(args)
    if not quiet:
        print(f"   $ {' '.join(cmd)}")
    proc = subprocess.run(
        cmd,
        env=env,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
    )
    return proc.returncode


def restic_backup(*, auto: bool = False) -> None:
    # systemd --auto must not hang on prompts; interactive backup may ask.
    env = restic_env(prompt=not auto, confirm_password=True)
    targets = backup_targets()
    if not targets:
        print("⚠️  No backup targets found (.env / volumes / */volumes / storage)")
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
    # Existing repo password — enter once, no "new password" confirmation.
    env = restic_env(prompt=True, confirm_password=False)
    print(f"\n☁️  Restoring Restic snapshot '{snapshot}' into repo root...")
    code = run_restic(
        ["restore", snapshot, "--target", "."],
        env=env,
    )
    if code != 0:
        print(f"❌ restic restore failed (exit {code})")
        sys.exit(code)
    print("✅ Cloud restore of files completed")
