"""Roundcube Webmail service — official multi-arch webmail for Maddy IMAP/SMTP."""
from __future__ import annotations

import os

from setup.service import Service, VolumeDir
from setup.ui import ok, section
from setup.utils import run_cmd

# UID/GID of www-data inside roundcube/roundcubemail (Apache/Debian base)
_WWW_DATA_UID = 33
_CARDDAV_VERSION = "v5.4.0"


class RoundcubeService(Service):
    name = "roundcube"
    volume_dirs = [
        VolumeDir("./roundcube/volumes/data", mode=0o755),
        VolumeDir("./roundcube/volumes/db", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Roundcube Webmail & CardDAV plugin...", emoji="✉️")

        plugins_dir = "./roundcube/volumes/data/plugins"
        carddav_dir = f"{plugins_dir}/carddav"

        os.makedirs(plugins_dir, exist_ok=True)

        if not os.path.exists(f"{carddav_dir}/carddav.php"):
            tar_url = f"https://github.com/mstilkerich/rcmcarddav/releases/download/{_CARDDAV_VERSION}/carddav-{_CARDDAV_VERSION}.tar.gz"
            tar_path = "/tmp/carddav.tar.gz"
            run_cmd(f"curl -fsSL '{tar_url}' -o {tar_path}")
            run_cmd(f"mkdir -p {carddav_dir}")
            run_cmd(f"tar -xzf {tar_path} -C {carddav_dir} --strip-components=1")
            run_cmd(f"rm -f {tar_path}")
            ok(f"Installed RCMCardDAV plugin {_CARDDAV_VERSION}")

        for path in ("./roundcube/volumes/data", "./roundcube/volumes/db"):
            run_cmd(f"sudo chown -R {_WWW_DATA_UID}:{_WWW_DATA_UID} {path} 2>/dev/null || true")

        ok("Roundcube volume directories & CardDAV plugin ready")


service = RoundcubeService()
