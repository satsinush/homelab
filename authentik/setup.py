"""Authentik service — volumes, Postgres dump/restore, LDAP outpost token sync."""
from __future__ import annotations

import os
import subprocess
import time
from datetime import datetime, timezone

from service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup_utils import gen_secret, run_cmd


def _read_secret(name: str) -> str:
    path = f"./volumes/secrets/{name}"
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


def _write_secret(name: str, value: str) -> None:
    os.makedirs("./volumes/secrets", exist_ok=True)
    path = f"./volumes/secrets/{name}"
    with open(path, "w", encoding="utf-8") as f:
        f.write(value.strip())
    os.chmod(path, 0o600)


def _ldap_outpost_token_from_ak() -> str:
    """Read Authentik-managed outpost token (ak-outpost-<pk>-api)."""
    script = r"""
from authentik.outposts.models import Outpost
o = Outpost.objects.filter(name="LDAP Outpost").first()
if o is None:
    raise SystemExit("LDAP Outpost missing")
print(o.token.key)
"""
    proc = subprocess.run(
        ["docker", "exec", "-i", "authentik-worker", "ak", "shell"],
        input=script,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(err or f"ak shell exit {proc.returncode}")
    # ak shell prints banners; token is the last non-empty line
    lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.strip()]
    if not lines:
        raise RuntimeError("empty ak shell output")
    return lines[-1]


class AuthentikService(Service):
    name = "authentik"
    volume_dirs = [
        VolumeDir("./authentik/volumes/media", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/templates", mode=0o755),
        VolumeDir("./authentik/volumes/certs", mode=0o755),
        VolumeDir("./authentik/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./authentik/volumes/db-dumps", mode=0o700),
        VolumeDir("./authentik/volumes/redis", uid=999, gid=999, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n🔑 Preparing Authentik volumes and secrets...")
        gen_secret("authentik_secret_key", 50)
        gen_secret("authentik_pg_pass", 32)
        gen_secret("authentik_akadmin_password", 32)
        gen_secret("ldap_bind_password", 32)
        # Placeholder until postsetup copies the real outpost token from Authentik
        if not _read_secret("authentik_ldap_outpost_token"):
            _write_secret("authentik_ldap_outpost_token", "pending-outpost-token")
        print("   ✅ Authentik volume directories ready")

    def postsetup(self, env: dict) -> None:
        print("\n🔑 Syncing Authentik LDAP outpost token...")
        token = ""
        for attempt in range(1, 31):
            try:
                token = _ldap_outpost_token_from_ak()
                if token and token != "pending-outpost-token":
                    break
            except Exception as exc:  # noqa: BLE001 — retry until blueprint applies
                if attempt == 30:
                    print(f"   ⚠️  Could not read LDAP Outpost token: {exc}")
                    print("   ℹ️  Admin → Applications → Outposts → LDAP Outpost → View Deployment Info")
                    return
            time.sleep(2)
        else:
            print("   ⚠️  LDAP Outpost token not ready yet")
            return

        prev = _read_secret("authentik_ldap_outpost_token")
        _write_secret("authentik_ldap_outpost_token", token)
        if prev != token:
            print("   ✅ Wrote volumes/secrets/authentik_ldap_outpost_token")
            run_cmd("docker compose up -d --force-recreate authentik-ldap", check=False)
            print("   ✅ Recreated authentik-ldap with managed outpost token")
        else:
            print("   ✅ LDAP outpost token already up to date")

    def backup(self, env: dict) -> None:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        dest = f"./authentik/volumes/db-dumps/authentik-{stamp}.sql"
        user = env.get("AUTHENTIK_PG_USER", "authentik")
        db = env.get("AUTHENTIK_PG_DB", "authentik")
        pg_dump_to_file(
            "authentik-postgres",
            db,
            user,
            dest,
            password_file="/run/secrets/authentik_pg_pass",
        )

    def restore(self, env: dict) -> None:
        dump = latest_file("./authentik/volumes/db-dumps", ".sql")
        if dump:
            user = env.get("AUTHENTIK_PG_USER", "authentik")
            db = env.get("AUTHENTIK_PG_DB", "authentik")
            pg_restore_from_file(
                "authentik-postgres",
                db,
                user,
                dump,
                password_file="/run/secrets/authentik_pg_pass",
            )


service = AuthentikService()
