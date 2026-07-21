"""SnappyMail service — Webmail client."""
from __future__ import annotations

from setup.service import Service, VolumeDir
from setup.ui import ok, section

import os

from setup.utils import run_cmd

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
            "use_short_login": False
        }
        
        domains_dir = "./snappymail/volumes/data/_data_/_default_/domains"
        try:
            os.makedirs(domains_dir, exist_ok=True)
        except PermissionError:
            run_cmd(f"sudo mkdir -p {domains_dir}", check=False)
            run_cmd(f"sudo chown -R {os.getuid()}:{os.getgid()} ./snappymail/volumes/data/_data_", check=False)
            os.makedirs(domains_dir, exist_ok=True)
        
        dest_path = f"{domains_dir}/{hostname}.json"
        try:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(domain_config, f, indent=4)
        except PermissionError:
            run_cmd(f"sudo chown -R {os.getuid()}:{os.getgid()} {domains_dir}", check=False)
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(domain_config, f, indent=4)
            
        try:
            os.chmod(dest_path, 0o600)
        except OSError:
            pass
            
        ok(f"Wrote SnappyMail domain config for {hostname}")
        ok("SnappyMail directories and volumes ready")

service = SnappyMailService()

