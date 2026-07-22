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
        section("Preparing Roundcube Webmail, CardDAV & Calendar plugins...", emoji="✉️")

        data_dir = "./roundcube/volumes/data"
        plugins_dir = f"{data_dir}/plugins"
        carddav_dir = f"{plugins_dir}/carddav"
        calendar_dir = f"{plugins_dir}/calendar"
        libcal_dir = f"{plugins_dir}/libcalendaring"
        db_file = f"{data_dir}/db/sqlite.db"

        # Temporarily grant host user write permissions
        run_cmd(f"sudo chown -R {os.getuid()}:{os.getgid()} ./roundcube/volumes 2>/dev/null || true")

        os.makedirs(f"{data_dir}/db", exist_ok=True)
        os.makedirs(plugins_dir, exist_ok=True)

        # 1. Install RCMCardDAV plugin
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

        # 2. Install Calendar plugin (JodliDev/calendar & libcalendaring)
        if not os.path.exists(f"{calendar_dir}/calendar.php"):
            try:
                # libcalendaring dependency
                libcal_url = "https://github.com/JodliDev/libcalendaring/archive/refs/heads/master.tar.gz"
                libcal_tar = "/tmp/libcal.tar.gz"
                run_cmd(f"curl -fsSL '{libcal_url}' -o {libcal_tar}")
                run_cmd(f"mkdir -p {libcal_dir}")
                run_cmd(f"tar -xzf {libcal_tar} -C {libcal_dir} --strip-components=1")
                run_cmd(f"rm -f {libcal_tar}")

                # calendar plugin
                cal_url = "https://github.com/JodliDev/calendar/archive/refs/heads/master.tar.gz"
                cal_tar = "/tmp/calendar.tar.gz"
                run_cmd(f"curl -fsSL '{cal_url}' -o {cal_tar}")
                run_cmd(f"mkdir -p {calendar_dir}")
                run_cmd(f"tar -xzf {cal_tar} -C {calendar_dir} --strip-components=1")
                run_cmd(f"rm -f {cal_tar}")

                ok("Installed Calendar plugin & libcalendaring")
            except Exception as e:
                warn(f"Failed to auto-download Calendar plugin: {e}")

        # Configure Calendar driver to 'database'
        cal_config_path = f"{calendar_dir}/config.inc.php"
        cal_config_content = """<?php
$config['calendar_driver'] = 'database';
$config['calendar_default_view'] = 'agendaWeek';
$config['calendar_timeslots'] = 2;
$config['calendar_first_day'] = 1;
"""
        with open(cal_config_path, "w", encoding="utf-8") as f:
            f.write(cal_config_content)

        # 3. Initialize CardDAV & Calendar database schemas
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        # CardDAV DB init
        carddav_sql = f"{carddav_dir}/dbmigrations/0000-dbinit/sqlite.sql"
        if os.path.exists(carddav_sql):
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='carddav_accounts';")
                if not cursor.fetchone():
                    with open(carddav_sql, "r", encoding="utf-8") as f:
                        conn.executescript(f.read())
                    conn.commit()
                    ok("Initialized CardDAV SQLite database tables")
            except Exception as e:
                warn(f"CardDAV SQLite DB migration note: {e}")

        # Calendar DB init
        cal_sql_candidates = (
            f"{calendar_dir}/drivers/database/SQL/sqlite.initial.sql",
            f"{calendar_dir}/drivers/database/SQL/sqlite.sql",
        )
        for cal_sql in cal_sql_candidates:
            if os.path.exists(cal_sql):
                try:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events';")
                    if not cursor.fetchone():
                        with open(cal_sql, "r", encoding="utf-8") as f:
                            conn.executescript(f.read())
                        conn.commit()
                        ok("Initialized Calendar SQLite database tables")
                    break
                except Exception as e:
                    warn(f"Calendar SQLite DB migration note: {e}")

        conn.close()

        # Set final container ownership (www-data)
        for path in ("./roundcube/volumes/data", "./roundcube/volumes/db"):
            run_cmd(f"sudo chown -R {_WWW_DATA_UID}:{_WWW_DATA_UID} {path} 2>/dev/null || true")

        ok("Roundcube volume directories, CardDAV & Calendar plugins ready")


service = RoundcubeService()
