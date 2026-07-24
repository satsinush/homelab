"""Vaultwarden service — admin token, SQLite snapshot/restore."""
from __future__ import annotations

import os
import secrets
import shlex

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.ui import ok, section, step, warn
from setup.utils import gen_secret, run_cmd


class VaultwardenService(Service):
    name = "vaultwarden"
    volume_dirs = [
        VolumeDir("./vaultwarden/volumes/data", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Vaultwarden secrets...", emoji="🔐")
        os.makedirs("./volumes/secrets", exist_ok=True)
        gen_secret("vaultwarden_oidc_secret", 64)
        gen_secret("vaultwarden_admin_token_plain", 48)
        gen_secret("stalwart_smtp_vaultwarden_password", 32)

        plain_token_path = "./volumes/secrets/vaultwarden_admin_token_plain"
        with open(plain_token_path, "r", encoding="utf-8") as f:
            plain_token = f.read().strip()

        admin_token_val = plain_token
        step("Generating secure Argon2 hash for Vaultwarden ADMIN_TOKEN...")
        try:
            salt = secrets.token_hex(8)
            hashed = run_cmd(f"echo -n {shlex.quote(plain_token)} | argon2 {salt} -id -e")
            if hashed:
                admin_token_val = hashed.strip()
                ok("Secure Argon2 hash generated for ADMIN_TOKEN")
            else:
                warn("Failed to generate Argon2 hash. Using plain text fallback.")
        except Exception as e:
            warn(f"Failed to generate Argon2 hash: {e}. Using plain text fallback.")

        token_path = "./volumes/secrets/vaultwarden_admin_token"
        with open(token_path, "w", encoding="utf-8") as f:
            f.write(admin_token_val)
        os.chmod(token_path, 0o600)

        env_path = "./volumes/secrets/vaultwarden.env"
        if os.path.exists(env_path):
            os.remove(env_path)

        ok("Vaultwarden admin token secret file prepared successfully")

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "vaultwarden",
            "/data/db.sqlite3",
            "/data/db_snapshot.sqlite3",
            host_bind="./vaultwarden/volumes/data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "vaultwarden",
            "/data/db.sqlite3",
            "./vaultwarden/volumes/data/db_snapshot.sqlite3",
            "./vaultwarden/volumes/data",
        )


service = VaultwardenService()
