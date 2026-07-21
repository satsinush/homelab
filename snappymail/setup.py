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

        target_domains = set()
        for key in ("HOMELAB_HOSTNAME", "DNS_DOMAIN"):
            val = env.get(key) or os.environ.get(key)
            if val:
                target_domains.add(val.strip().lower())
        target_domains.add("localhost")

        import json

        domains_dir = "./snappymail/volumes/data/_data_/_default_/domains"
        try:
            os.makedirs(domains_dir, exist_ok=True)
        except PermissionError:
            run_cmd(f"sudo mkdir -p {domains_dir}", check=False)

        import tempfile
        for domain_name in sorted(target_domains):
            domain_config = {
                "disabled": False,
                "name": domain_name,
                "imap": {
                    "host": "maddy",
                    "port": 143,
                    "secure": "none",
                    "timeout": 30,
                },
                "smtp": {
                    "host": "maddy",
                    "port": 587,
                    "secure": "none",
                    "auth": True,
                    "timeout": 30,
                },
            }
            dest_path = f"{domains_dir}/{domain_name}.json"
            try:
                with open(dest_path, "w", encoding="utf-8") as f:
                    json.dump(domain_config, f, indent=4)
            except PermissionError:
                with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as tmp:
                    json.dump(domain_config, tmp, indent=4)
                    tmp_path = tmp.name
                run_cmd(f"sudo cp {tmp_path} {dest_path}", check=False)
                os.unlink(tmp_path)
            ok(f"Wrote SnappyMail domain config for {domain_name}")

        # Ensure container user (www-data UID 82:82) owns all data volume files
        run_cmd(f"sudo chown -R {_SNAPPYMAIL_UID}:{_SNAPPYMAIL_GID} ./snappymail/volumes/data", check=False)

        ok("SnappyMail directories and volumes ready")

service = SnappyMailService()

