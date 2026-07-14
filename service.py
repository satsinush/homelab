"""Abstract Service base class for per-service setup, backup, and restore hooks."""
from __future__ import annotations

import os
import shutil
import subprocess
from abc import ABC
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class VolumeDir:
    """Host bind-mount directory with ownership/mode requirements."""

    path: str
    uid: int = 0
    gid: int = 0
    mode: int = 0o755


def ensure_volume_dir(spec: VolumeDir) -> None:
    """Create a volume directory and apply ownership/mode (sudo when needed)."""
    os.makedirs(spec.path, exist_ok=True)
    try:
        os.chown(spec.path, spec.uid, spec.gid)
    except PermissionError:
        subprocess.run(
            ["sudo", "chown", f"{spec.uid}:{spec.gid}", spec.path],
            check=False,
        )
    try:
        os.chmod(spec.path, spec.mode)
    except PermissionError:
        subprocess.run(
            ["sudo", "chmod", oct(spec.mode)[2:], spec.path],
            check=False,
        )


def container_running(name: str) -> bool:
    from setup_utils import run_cmd

    state = run_cmd(
        f"docker inspect -f '{{{{.State.Running}}}}' {name} 2>/dev/null",
        check=False,
    )
    return state == "true"


def latest_file(directory: str, suffix: str = "") -> str | None:
    if not os.path.isdir(directory):
        return None
    files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if os.path.isfile(os.path.join(directory, f)) and (not suffix or f.endswith(suffix))
    ]
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def sqlite_snapshot(
    container: str,
    db_path: str,
    snapshot_path: str,
    host_bind: str | None = None,
) -> bool:
    """Create a consistent SQLite snapshot. Prefer in-container sqlite3; else alpine bind."""
    from setup_utils import run_cmd

    if not container_running(container):
        print(f"   ℹ️  {container} not running; skipping SQLite snapshot for {db_path}")
        return False

    # Try native sqlite3 inside the container
    quoted_db = db_path.replace("'", "'\\''")
    quoted_snap = snapshot_path.replace("'", "'\\''")
    result = run_cmd(
        f"docker exec {container} sh -c \"command -v sqlite3 >/dev/null && "
        f"sqlite3 '{quoted_db}' \\\".backup '{quoted_snap}'\\\"\"",
        check=False,
    )
    if result is not None:
        # run_cmd returns "" on success with empty stdout — distinguish failure
        # Re-check: if snapshot exists in container, success
        exists = run_cmd(
            f"docker exec {container} test -f '{quoted_snap}' && echo ok",
            check=False,
        )
        if exists == "ok":
            print(f"   ✅ SQLite snapshot: {container}:{snapshot_path}")
            return True

    if not host_bind:
        print(f"   ⚠️  Could not snapshot {container}:{db_path} (no sqlite3 / no host bind)")
        return False

    # Fallback: alpine + sqlite against the host bind mount
    db_name = os.path.basename(db_path)
    snap_name = os.path.basename(snapshot_path)
    host_db = os.path.join(host_bind, db_name)
    if not os.path.isfile(host_db):
        # db might live in a subdirectory under the bind
        print(f"   ⚠️  Host DB not found at {host_db}; skipping snapshot")
        return False

    abs_bind = os.path.abspath(host_bind)
    run_cmd(
        "docker run --rm "
        f"-v {abs_bind}:/data "
        "keinos/sqlite3:latest "
        f'sh -c "sqlite3 /data/{db_name} \\\".backup \'/data/{snap_name}\'\\\"\"',
        check=False,
    )
    host_snap = os.path.join(host_bind, snap_name)
    if os.path.isfile(host_snap):
        print(f"   ✅ SQLite snapshot (bind): {host_snap}")
        return True
    print(f"   ⚠️  SQLite snapshot failed for {host_db}")
    return False


def restore_sqlite_snapshot(
    container: str,
    live_db: str,
    snapshot_path: str,
    host_bind: str,
) -> bool:
    """Replace live SQLite DB with snapshot (stop container briefly)."""
    from setup_utils import run_cmd

    host_snap = snapshot_path
    if not os.path.isabs(host_snap) and not os.path.isfile(host_snap):
        host_snap = os.path.join(host_bind, os.path.basename(snapshot_path))
    if not os.path.isfile(host_snap):
        print(f"   ℹ️  No snapshot at {host_snap}; skipping SQLite restore for {container}")
        return False

    live_name = os.path.basename(live_db)
    host_live = os.path.join(host_bind, live_name)
    print(f"   Restoring SQLite for {container} from {host_snap}...")
    run_cmd(f"docker stop {container}", check=False)
    try:
        shutil.copy2(host_snap, host_live)
        # Clear WAL/SHM companions if present
        for suffix in ("-wal", "-shm"):
            companion = host_live + suffix
            if os.path.exists(companion):
                os.remove(companion)
        print(f"   ✅ Restored {host_live}")
        return True
    finally:
        run_cmd(f"docker start {container}", check=False)


def pg_dump_to_file(
    container: str,
    database: str,
    user: str,
    dest_path: str,
    password_file: str | None = None,
) -> bool:
    """Dump Postgres to a host file via docker exec (stdout redirect)."""
    from setup_utils import run_cmd

    if not container_running(container):
        print(f"   ℹ️  {container} not running; skipping pg_dump")
        return False

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if password_file:
        inner = (
            f"export PGPASSWORD=\\\"\\$(cat {password_file})\\\" && "
            f"pg_dump -U {user} -d {database} --clean --if-exists"
        )
    else:
        inner = f"pg_dump -U {user} -d {database} --clean --if-exists"
    cmd = f'docker exec {container} sh -c "{inner}" > {dest_path}'
    result = run_cmd(cmd, check=False)
    if result is not None and os.path.isfile(dest_path) and os.path.getsize(dest_path) > 0:
        print(f"   ✅ pg_dump → {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return True
    print(f"   ⚠️  pg_dump failed for {container}/{database}")
    return False


def pg_restore_from_file(
    container: str,
    database: str,
    user: str,
    dump_path: str,
    password_file: str | None = None,
) -> bool:
    from setup_utils import run_cmd

    if not os.path.isfile(dump_path):
        print(f"   ℹ️  No dump at {dump_path}; skipping pg restore for {container}")
        return False
    if not container_running(container):
        print(f"   ⚠️  {container} not running; cannot restore Postgres")
        return False

    print(f"   Restoring Postgres {database} from {dump_path}...")
    if password_file:
        inner = (
            f"export PGPASSWORD=\\\"\\$(cat {password_file})\\\" && "
            f"psql -U {user} -d {database}"
        )
    else:
        inner = f"psql -U {user} -d {database}"
    result = run_cmd(
        f'docker exec -i {container} sh -c "{inner}" < {dump_path}',
        check=False,
    )
    if result is not None:
        print(f"   ✅ Postgres restore applied for {container}/{database}")
        return True
    print(f"   ⚠️  Postgres restore may have failed for {container}/{database}")
    return False


class Service(ABC):
    """Lifecycle hooks for a homelab compose stack."""

    name: str = "service"
    volume_dirs: list[VolumeDir] = []

    def setup(self, env: dict) -> None:
        """Before containers are up. Default: ensure volume_dirs."""
        if not self.volume_dirs:
            return
        print(f"\n📁 Preparing {self.name} volume directories...")
        for spec in self.volume_dirs:
            ensure_volume_dir(spec)
        print(f"   ✅ {self.name} volumes ready")

    def postsetup(self, env: dict) -> None:
        """After containers are healthy. Default: no-op."""
        return None

    def backup(self, env: dict) -> None:
        """Before Restic upload. Default: no-op."""
        return None

    def restore(self, env: dict) -> None:
        """After cloud restore + compose up. Default: no-op."""
        return None


def run_all_setup(services: Iterable[Service], env: dict) -> None:
    for svc in services:
        svc.setup(env)


def run_all_postsetup(services: Iterable[Service], env: dict) -> None:
    for svc in services:
        svc.postsetup(env)


def run_all_backup(services: Iterable[Service], env: dict) -> None:
    for svc in services:
        print(f"\n💾 Backup hooks: {svc.name}")
        svc.backup(env)


def run_all_restore(services: Iterable[Service], env: dict) -> None:
    for svc in services:
        print(f"\n♻️  Restore hooks: {svc.name}")
        svc.restore(env)
