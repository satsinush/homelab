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
    """Host bind-mount directory with ownership/mode requirements.

    uid/gid None means the current host user (setup can write the tree).
    Use explicit container UIDs (e.g. 33, 70, 999) only when required.
    """

    path: str
    uid: int | None = None
    gid: int | None = None
    mode: int = 0o755


def host_uid_gid() -> tuple[int, int]:
    uid = os.getuid() if hasattr(os, "getuid") else 1000
    gid = os.getgid() if hasattr(os, "getgid") else 1000
    return uid, gid


def _sudo(args: list[str]) -> bool:
    """Run sudo. Prefer passwordless; prompt only when stdin is a TTY."""
    if subprocess.run(["sudo", "-n", *args], check=False).returncode == 0:
        return True
    if hasattr(os, "isatty") and os.isatty(0):
        return subprocess.run(["sudo", *args], check=False).returncode == 0
    return False


def remove_path(path: str) -> bool:
    """Delete a file or directory tree; use sudo when the host user cannot."""
    if not os.path.lexists(path):
        return False
    try:
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return True
    except PermissionError:
        pass
    if _sudo(["rm", "-rf", path]):
        return True
    print(f"   ⚠️  Failed to remove {path}")
    return False


def _mkdir_via_docker(path: str, uid: int, gid: int, mode: int) -> None:
    """Create path by mounting the nearest existing ancestor into Alpine."""
    abs_path = os.path.abspath(path)
    ancestor = abs_path
    while not os.path.isdir(ancestor):
        parent = os.path.dirname(ancestor)
        if parent == ancestor:
            raise PermissionError(f"Cannot create {path}: no existing ancestor")
        ancestor = parent
    rel = os.path.relpath(abs_path, ancestor)
    if rel.startswith(".."):
        raise PermissionError(f"Cannot create {path}: path escapes mount root")
    mode_oct = oct(mode)[2:]
    # Quote-safe: paths are homelab-controlled; avoid shell metacharacters.
    target = "." if rel == "." else rel
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{ancestor}:/mnt",
            "alpine:3.20",
            "sh",
            "-c",
            f"mkdir -p /mnt/{target} && chown {uid}:{gid} /mnt/{target} "
            f"&& chmod {mode_oct} /mnt/{target}",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()[:300]
        raise PermissionError(f"Cannot create {path}: Docker fallback failed: {err}")


def ensure_volume_dir(spec: VolumeDir) -> None:
    """Create a volume directory and apply ownership/mode (sudo/Docker when needed)."""
    host_uid, host_gid = host_uid_gid()
    uid = host_uid if spec.uid is None else spec.uid
    gid = host_gid if spec.gid is None else spec.gid
    mode_oct = oct(spec.mode)[2:]

    try:
        os.makedirs(spec.path, exist_ok=True)
    except PermissionError:
        if not _sudo(["mkdir", "-p", spec.path]):
            _mkdir_via_docker(spec.path, uid, gid, spec.mode)
            return

    try:
        os.chown(spec.path, uid, gid)
    except PermissionError:
        if not _sudo(["chown", f"{uid}:{gid}", spec.path]):
            _mkdir_via_docker(spec.path, uid, gid, spec.mode)
            return
    try:
        os.chmod(spec.path, spec.mode)
    except PermissionError:
        if not _sudo(["chmod", mode_oct, spec.path]):
            _mkdir_via_docker(spec.path, uid, gid, spec.mode)


def write_host_file(path: str, content: str, mode: int = 0o644) -> None:
    """Write a file as the host user; reclaim or use Docker if the parent is root-owned."""
    parent = os.path.dirname(path) or "."
    ensure_volume_dir(VolumeDir(parent))
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        os.chmod(path, mode)
        return
    except PermissionError:
        pass

    uid, gid = host_uid_gid()
    _sudo(["chown", "-R", f"{uid}:{gid}", parent])
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        os.chmod(path, mode)
        return
    except PermissionError:
        pass

    abs_parent = os.path.abspath(parent)
    name = os.path.basename(path)
    mode_oct = oct(mode)[2:]
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-i",
            "-v",
            f"{abs_parent}:/out",
            "alpine:3.20",
            "sh",
            "-c",
            f"cat > /out/{name} && chmod {mode_oct} /out/{name}",
        ],
        input=content.encode("utf-8"),
        check=False,
    )
    if result.returncode != 0:
        raise PermissionError(
            f"Cannot write {path}: directory is not writable and Docker fallback failed"
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
    """Create a consistent SQLite snapshot via .backup against the host bind mount.

    App containers typically lack sqlite3. Volume dirs are often root-owned, so the
    helper container runs as uid 0 to write the snapshot beside the live DB.
    """
    if not container_running(container):
        print(f"   ℹ️  {container} not running; skipping SQLite snapshot for {db_path}")
        return False

    if not host_bind:
        print(f"   ⚠️  No host_bind for {container}:{db_path}; cannot snapshot")
        return False

    db_name = os.path.basename(db_path)
    snap_name = os.path.basename(snapshot_path)
    host_db = os.path.join(host_bind, db_name)
    host_snap = os.path.join(host_bind, snap_name)
    if not os.path.isfile(host_db):
        print(f"   ⚠️  Host DB not found at {host_db}; skipping snapshot")
        return False

    abs_bind = os.path.abspath(host_bind)
    # --user 0:0: bind mounts from app containers are frequently root:root
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--user",
            "0:0",
            "-v",
            f"{abs_bind}:/data",
            "--entrypoint",
            "sqlite3",
            "keinos/sqlite3:latest",
            f"/data/{db_name}",
            f".backup /data/{snap_name}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and os.path.isfile(host_snap):
        print(f"   ✅ SQLite snapshot: {host_snap} ({os.path.getsize(host_snap)} bytes)")
        return True

    err = (result.stderr or result.stdout or "").strip()
    detail = f" ({err})" if err else ""
    print(f"   ⚠️  SQLite snapshot failed for {host_db}{detail}")
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
        try:
            shutil.copy2(host_snap, host_live)
        except PermissionError:
            abs_bind = os.path.abspath(host_bind)
            snap_name = os.path.basename(host_snap)
            copied = subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--user",
                    "0:0",
                    "-v",
                    f"{abs_bind}:/data",
                    "alpine:3.20",
                    "sh",
                    "-c",
                    f"cp '/data/{snap_name}' '/data/{live_name}'",
                ],
                check=False,
            )
            if copied.returncode != 0:
                print(f"   ⚠️  Failed to restore {host_live}")
                return False
        for suffix in ("-wal", "-shm"):
            companion = host_live + suffix
            if os.path.exists(companion):
                remove_path(companion)
        print(f"   ✅ Restored {host_live}")
        return True
    finally:
        run_cmd(f"docker start {container}", check=False)


def _pg_role_statements(dumpall_roles: str, role_prefix: str) -> str:
    """Keep CREATE/ALTER ROLE statements for roles whose name starts with role_prefix."""
    keep: list[str] = []
    for line in dumpall_roles.splitlines(keepends=True):
        stripped = line.lstrip()
        if not (
            stripped.startswith("CREATE ROLE ") or stripped.startswith("ALTER ROLE ")
        ):
            continue
        parts = stripped.split(None, 2)
        if len(parts) < 3:
            continue
        name = parts[2].replace(";", " ").split(None, 1)[0].strip('"')
        if name.startswith(role_prefix):
            keep.append(line if line.endswith("\n") else line + "\n")
    return "".join(keep)


def pg_dump_to_file(
    container: str,
    database: str,
    user: str,
    dest_path: str,
    password_file: str | None = None,
    *,
    role_prefix: str | None = None,
) -> bool:
    """Dump Postgres to a host file via docker exec (stdout redirect).

    If role_prefix is set (e.g. \"oc_\"), prepend matching role definitions from
    pg_dumpall --roles-only so restores get login roles/password hashes that
    plain pg_dump omits.
    """
    from setup_utils import run_cmd

    if not container_running(container):
        print(f"   ℹ️  {container} not running; skipping pg_dump")
        return False

    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    if password_file:
        pw = f'export PGPASSWORD=\\"\\$(cat {password_file})\\" && '
    else:
        pw = ""

    parts: list[str] = []
    if role_prefix:
        roles_cmd = f'docker exec {container} sh -c "{pw}pg_dumpall -U {user} --roles-only"'
        roles_out = run_cmd(roles_cmd, check=False)
        if roles_out:
            role_sql = _pg_role_statements(roles_out, role_prefix)
            if role_sql.strip():
                parts.append(
                    "-- Homelab: roles omitted by pg_dump "
                    f"(prefix {role_prefix!r})\n"
                    + role_sql
                    + "\n"
                )
            else:
                print(f"   ⚠️  No roles matching prefix {role_prefix!r} in pg_dumpall")
        else:
            print(f"   ⚠️  pg_dumpall --roles-only failed for {container}")

    dump_cmd = (
        f'docker exec {container} sh -c "{pw}pg_dump -U {user} -d {database} '
        f'--clean --if-exists"'
    )
    dump_out = run_cmd(dump_cmd, check=False)
    if not dump_out:
        print(f"   ⚠️  pg_dump failed for {container}/{database}")
        return False
    parts.append(dump_out)

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write("".join(parts))
        if not parts[-1].endswith("\n"):
            f.write("\n")

    size = os.path.getsize(dest_path)
    if size > 0:
        print(f"   ✅ pg_dump → {dest_path} ({size} bytes)")
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
    # Extra host paths to delete on reset (beyond ./{name}/volumes).
    reset_extra_paths: list[str] = []

    def setup(self, env: dict) -> None:
        """Before containers are up. Default: ensure volume_dirs."""
        if not self.volume_dirs:
            return
        print(f"\n📁 Preparing {self.name} volume directories...")
        for spec in self.volume_dirs:
            ensure_volume_dir(spec)
        print(f"   ✅ {self.name} volumes ready")

    def postsetup(self, env: dict) -> None:
        """After the first health wait. Default: no-op.

        Override for one-shot wiring that needs healthy containers (OIDC,
        notification tokens, etc.).
        """
        return None

    def backup(self, env: dict) -> None:
        """Before Restic upload. Default: no-op."""
        return None

    def restore(self, env: dict) -> None:
        """After cloud restore + compose up. Default: no-op."""
        return None

    def reset_paths(self) -> list[str]:
        """Host paths owned by this service that reset() should remove."""
        paths = [f"./{self.name}/volumes"]
        paths.extend(self.reset_extra_paths)
        return paths

    def reset(self, env: dict) -> None:
        """Remove this service's local bind-mount / config state."""
        print(f"\n🧹 Resetting {self.name}...")
        removed_any = False
        for path in self.reset_paths():
            if remove_path(path):
                print(f"   ✅ Removed {path}")
                removed_any = True
        if not removed_any:
            print("   ℹ️  Nothing to remove")


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


def run_all_reset(services: Iterable[Service], env: dict) -> None:
    for svc in services:
        svc.reset(env)
