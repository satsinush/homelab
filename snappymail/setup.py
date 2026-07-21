"""SnappyMail service — Webmail client."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import ok, section

import os

from setup.utils import run_cmd

# UID/GID of www-data inside php:8.2-fpm-alpine (djmaze/snappymail:latest)
_SNAPPYMAIL_UID = 82
_SNAPPYMAIL_GID = 82


class SnappyMailService(Service):
    name = "snappymail"
    volume_dirs = [
        VolumeDir("./snappymail/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing SnappyMail Webmail...", emoji="✉️")

        import json
        hostname = env.get("HOMELAB_HOSTNAME") or os.environ.get("HOMELAB_HOSTNAME") or "localhost"

        domain_config = {
            "imap_host": "maddy",
            "imap_port": 143,
            "imap_secure": "none",
            "smtp_host": "maddy",
            "smtp_port": 587,
            "smtp_secure": "none",
            "smtp_auth": True,
            "use_short_login": False,
        }

        domains_dir = "./snappymail/volumes/data/_data_/_default_/domains"
        try:
            os.makedirs(domains_dir, exist_ok=True)
        except PermissionError:
            run_cmd(f"sudo mkdir -p {domains_dir}", check=False)

        dest_path = f"{domains_dir}/{hostname}.json"
        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(domain_config, f, indent=4)
        except PermissionError:
            import tempfile
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as tmp:
                json.dump(domain_config, tmp, indent=4)
                tmp_path = tmp.name
            run_cmd(f"sudo cp {tmp_path} {dest_path}", check=False)
            os.unlink(tmp_path)

        # Ensure container user (www-data UID 82:82) owns all data volume files
        run_cmd(f"sudo chown -R {_SNAPPYMAIL_UID}:{_SNAPPYMAIL_GID} ./snappymail/volumes/data", check=False)

        ok(f"Wrote SnappyMail domain config for {hostname}")
        ok("SnappyMail directories and volumes ready")

service = SnappyMailService()

