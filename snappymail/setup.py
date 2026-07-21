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

        # Check existing owner UID/GID of _data_ if it exists (typically www-data)
        target_uid = os.getuid()
        target_gid = os.getgid()
        data_dir = "./snappymail/volumes/data/_data_"
        if os.path.exists(data_dir):
            st = os.stat(data_dir)
            # If owned by host user, restore ownership to www-data (UID 82 or 33) if previously broken
            if st.st_uid == os.getuid():
                run_cmd(f"sudo chown -R 82:82 {data_dir} 2>/dev/null || sudo chown -R 33:33 {data_dir} 2>/dev/null || true", check=False)
                if os.path.exists(data_dir):
                    st = os.stat(data_dir)
            target_uid, target_gid = st.st_uid, st.st_gid

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

        # Restore www-data container ownership on created domain config directory/file
        if os.path.exists(domains_dir):
            run_cmd(f"sudo chown -R {target_uid}:{target_gid} {domains_dir}", check=False)

        ok(f"Wrote SnappyMail domain config for {hostname}")
        ok("SnappyMail directories and volumes ready")

service = SnappyMailService()

