"""Roundcube Webmail service — official multi-arch webmail for Maddy IMAP/SMTP."""
from __future__ import annotations

import json
import os
import sqlite3
import urllib.request

from setup.service import Service, VolumeDir
from setup.ui import ok, section, warn
from setup.utils import run_cmd

# UID/GID of www-data inside roundcube/roundcubemail (Apache/Debian base)
_WWW_DATA_UID = 33


class RoundcubeService(Service):
    name = "roundcube"
    volume_dirs = [
        VolumeDir("./roundcube/volumes/data", mode=0o755),
        VolumeDir("./roundcube/volumes/db", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Roundcube Webmail & CardDAV plugin...", emoji="✉️")

        data_dir = "./roundcube/volumes/data"
        plugins_dir = f"{data_dir}/plugins"
        carddav_dir = f"{plugins_dir}/carddav"
        db_file = f"{data_dir}/db/sqlite.db"

        # Temporarily grant host user write permissions to setup plugin & DB schema
        run_cmd(f"sudo chown -R {os.getuid()}:{os.getgid()} ./roundcube/volumes 2>/dev/null || true")

        os.makedirs(f"{data_dir}/db", exist_ok=True)
        os.makedirs(plugins_dir, exist_ok=True)

        if not os.path.exists(f"{carddav_dir}/carddav.php"):
            api_url = "https://api.github.com/repos/mstilkerich/rcmcarddav/releases/latest"
            headers = {"User-Agent": "Homelab-Setup"}
            req = urllib.request.Request(api_url, headers=headers)
            try:
                with urllib.request.urlopen(req) as resp:
                    release_data = json.loads(resp.read().decode())

                tar_url = None
                for asset in release_data.get("assets", []):
                    if asset["name"].endswith(".tar.gz"):
                        tar_url = asset["browser_download_url"]
                        break

                if not tar_url:
                    tag = release_data.get("tag_name", "v5.3.0")
                    tar_url = f"https://github.com/mstilkerich/rcmcarddav/releases/download/{tag}/carddav-{tag}.tar.gz"

                tar_path = "/tmp/carddav.tar.gz"
                run_cmd(f"curl -fsSL '{tar_url}' -o {tar_path}")
                run_cmd(f"mkdir -p {carddav_dir}")
                run_cmd(f"tar -xzf {tar_path} -C {carddav_dir} --strip-components=1")
                run_cmd(f"rm -f {tar_path}")
                ok(f"Installed RCMCardDAV plugin ({release_data.get('tag_name')})")
            except Exception as e:
                warn(f"Failed to auto-download RCMCardDAV plugin: {e}")

        # Initialize CardDAV SQLite database schema
        sql_file = f"{carddav_dir}/dbmigrations/0000-dbinit/sqlite.sql"
        if os.path.exists(sql_file):
            try:
                conn = sqlite3.connect(db_file)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='carddav_accounts';")
                if not cursor.fetchone():
                    with open(sql_file, "r", encoding="utf-8") as f:
                        schema = f.read()
                    conn.executescript(schema)
                    conn.commit()
                    ok(f"Initialized CardDAV SQLite database tables in {db_file}")
                conn.close()
            except Exception as e:
                warn(f"CardDAV SQLite DB migration note: {e}")

        # Set final container ownership (www-data)
        for path in ("./roundcube/volumes/data", "./roundcube/volumes/db"):
            run_cmd(f"sudo chown -R {_WWW_DATA_UID}:{_WWW_DATA_UID} {path} 2>/dev/null || true")

        ok("Roundcube volume directories & CardDAV plugin ready")


service = RoundcubeService()
