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
        libkolab_dir = f"{plugins_dir}/libkolab"

        # Candidate DB paths
        db_paths = [
            "./roundcube/volumes/db/sqlite.db",
            "./roundcube/volumes/data/db/sqlite.db",
        ]

        # Temporarily grant host user write permissions
        run_cmd(f"sudo chown -R {os.getuid()}:{os.getgid()} ./roundcube/volumes 2>/dev/null || true")

        for db_p in db_paths:
            os.makedirs(os.path.dirname(db_p), exist_ok=True)
        os.makedirs(plugins_dir, exist_ok=True)

        # Ensure composer.json includes sabre/dav dependency for CalDAV driver
        composer_json_path = f"{data_dir}/composer.json"
        if os.path.exists(composer_json_path):
            try:
                with open(composer_json_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                reqs = cdata.get("require", {})
                if "sabre/dav" not in reqs:
                    reqs["sabre/dav"] = "^4.4"
                    cdata["require"] = reqs
                    with open(composer_json_path, "w", encoding="utf-8") as f:
                        json.dump(cdata, f, indent=4)
                    ok("Added sabre/dav to Roundcube composer.json")
            except Exception as e:
                warn(f"composer.json update note: {e}")

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

        # 2. Install Calendar plugin dependencies (libkolab, libcalendaring & calendar)
        if not os.path.exists(f"{calendar_dir}/calendar.php") or not os.path.exists(f"{libcal_dir}/libcalendaring.php") or not os.path.exists(f"{libkolab_dir}/libkolab.php"):
            try:
                # libkolab dependency
                libkolab_url = "https://github.com/kolab-roundcube-plugins-mirror/libkolab/archive/refs/heads/master.tar.gz"
                libkolab_tar = "/tmp/libkolab.tar.gz"
                run_cmd(f"curl -fsSL '{libkolab_url}' -o {libkolab_tar}")
                run_cmd(f"rm -rf {libkolab_dir}")
                run_cmd(f"mkdir -p {libkolab_dir}")
                run_cmd(f"tar -xzf {libkolab_tar} -C {libkolab_dir} --strip-components=1")
                run_cmd(f"rm -f {libkolab_tar}")

                # libcalendaring dependency
                libcal_url = "https://github.com/JodliDev/libcalendaring/archive/refs/heads/master.tar.gz"
                libcal_tar = "/tmp/libcal.tar.gz"
                run_cmd(f"curl -fsSL '{libcal_url}' -o {libcal_tar}")
                run_cmd(f"rm -rf {libcal_dir}")
                run_cmd(f"mkdir -p {libcal_dir}")
                run_cmd(f"tar -xzf {libcal_tar} -C {libcal_dir} --strip-components=1")
                run_cmd(f"rm -f {libcal_tar}")

                # calendar plugin
                cal_url = "https://github.com/JodliDev/calendar/archive/refs/heads/master.tar.gz"
                cal_tar = "/tmp/calendar.tar.gz"
                run_cmd(f"curl -fsSL '{cal_url}' -o {cal_tar}")
                run_cmd(f"rm -rf {calendar_dir}")
                run_cmd(f"mkdir -p {calendar_dir}")
                run_cmd(f"tar -xzf {cal_tar} -C {calendar_dir} --strip-components=1")
                run_cmd(f"rm -f {cal_tar}")

                ok("Installed Calendar plugin, libkolab & libcalendaring")
            except Exception as e:
                warn(f"Failed to auto-download Calendar plugin dependencies: {e}")

        # Configure Calendar driver to 'caldav'
        cal_config_path = f"{calendar_dir}/config.inc.php"
        cal_config_content = """<?php
$config['calendar_driver'] = 'caldav';
$config['calendar_caldav_url'] = 'http://radicale:5232/calendar';
$config['calendar_attachments'] = false;
$config['calendar_default_view'] = 'agendaWeek';
$config['calendar_timeslots'] = 2;
$config['calendar_first_day'] = 1;
"""
        with open(cal_config_path, "w", encoding="utf-8") as f:
            f.write(cal_config_content)

        # 3. Initialize CardDAV & Calendar database schemas for all DB locations
        carddav_sql = f"{carddav_dir}/dbmigrations/0000-dbinit/sqlite.sql"
        sql_files = []
        if os.path.exists(calendar_dir):
            for root, _, files in os.walk(calendar_dir):
                for file in files:
                    if file.endswith(".sql") and "sqlite" in file.lower():
                        sql_files.append(os.path.join(root, file))
        sql_files = sorted(sql_files)

        for db_file in db_paths:
            try:
                conn = sqlite3.connect(db_file)
                cursor = conn.cursor()

                # CardDAV DB init
                if os.path.exists(carddav_sql):
                    try:
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='carddav_accounts';")
                        if not cursor.fetchone():
                            with open(carddav_sql, "r", encoding="utf-8") as f:
                                conn.executescript(f.read())
                            conn.commit()
                            ok(f"Initialized CardDAV SQLite database tables in {db_file}")
                    except Exception as e:
                        warn(f"CardDAV SQLite DB migration note ({db_file}): {e}")

                # Calendar DB init
                for cal_sql in sql_files:
                    try:
                        with open(cal_sql, "r", encoding="utf-8") as f:
                            sql_script = f.read()
                        conn.executescript(sql_script)
                        conn.commit()
                        ok(f"Applied Calendar SQL schema ({os.path.basename(cal_sql)}) to {db_file}")
                    except Exception:
                        pass

                conn.close()
            except Exception as e:
                warn(f"DB init note for {db_file}: {e}")

        # Set final container ownership (www-data)
        for path in ("./roundcube/volumes/data", "./roundcube/volumes/db"):
            run_cmd(f"sudo chown -R {_WWW_DATA_UID}:{_WWW_DATA_UID} {path} 2>/dev/null || true")

        ok("Roundcube volume directories, CardDAV & Calendar plugins ready")


service = RoundcubeService()
