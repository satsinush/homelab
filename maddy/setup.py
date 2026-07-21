"""Maddy Mail Server service — lightweight local SMTP/IMAP server provisioning."""
from __future__ import annotations

import os
import shlex

from setup.file_accounts import read_accounts_json
from setup.service import Service, VolumeDir
from setup.ui import ok, section, info
from setup.utils import run_cmd, substitute_env_vars


def compile_maddy_configs(env: dict) -> None:
    # Read maddy.conf template and substitute environment variables
    template_path = "./maddy/maddy.conf"
    with open(template_path, encoding="utf-8") as f:
        content = f.read()

    # Expand any homelab environment variables (like ${HOMELAB_HOSTNAME})
    # Since we are running setup.py, these environment variables are loaded in os.environ
    expanded_content = substitute_env_vars(content)

    dest_path = "./maddy/volumes/data/maddy.conf"
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(expanded_content)
    
    # Ensure correct permissions
    os.chmod(dest_path, 0o600)
    ok(f"Wrote {dest_path}")


class MaddyService(Service):
    name = "maddy"
    volume_dirs = [
        VolumeDir("./maddy/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Maddy Mail Server configuration...", emoji="📧")
        compile_maddy_configs(env)

    def sync_accounts(self, env: dict, users: list[dict]) -> bool:
        # Build set of all accounts to sync
        accounts = {u["username"]: u["password"] for u in users}

        hostname = env.get("HOMELAB_HOSTNAME") or os.environ.get("HOMELAB_HOSTNAME") or "localhost"

        for username, password in sorted(accounts.items()):
            email = username if "@" in username else f"{username}@{hostname}"
            
            # 1. Create the IMAP storage account if it doesn't exist
            # Note: maddy imap-acct create returns exit code 1 if it already exists, so check=False
            run_cmd(
                f"docker exec -i maddy maddy imap-acct create {shlex.quote(email)}",
                check=False
            )

            # 2. Create credentials using --stdin. If it exists, update the password.
            # Try to create first:
            cmd_create = f"echo {shlex.quote(password)} | docker exec -i maddy maddy creds create {shlex.quote(email)} --stdin"
            res = run_cmd(cmd_create, check=False)
            
            # If the creation fails (e.g. user already exists), update the password instead
            if res is None:
                cmd_pass = f"echo {shlex.quote(password)} | docker exec -i maddy maddy creds password {shlex.quote(email)} --stdin"
                run_cmd(cmd_pass, check=True)

        ok(f"Synced {len(accounts)} local email account(s) to Maddy")
        return False

    def postsetup(self, env: dict) -> None:
        section("Provisioning Maddy Mail Server accounts...", emoji="📧")
        self.sync_accounts(env, read_accounts_json())


service = MaddyService()
