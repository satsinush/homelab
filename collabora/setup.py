"""Collabora service — admin password secret and CA bundle for WOPI SSL."""
from __future__ import annotations

import subprocess
from pathlib import Path

from service import Service, write_host_file
from setup_utils import gen_secret, run_cmd

BUNDLE_NAME = "collabora-ca-bundle.crt"
BUNDLE_PATH = Path("./volumes/certificates") / BUNDLE_NAME
CA_PATH = Path("./volumes/certificates/homelab-ca.crt")


def ensure_collabora_ca_bundle() -> bool:
    """Ensure host file exists for Collabora's CA bind-mount (before compose up).

    If the mount path is missing when Docker starts, Docker creates a *directory*
    with that name. Detect and replace that with a real PEM bundle.

    Returns True if Collabora must be force-recreated (dir→file mount fix).
    """
    recreate = False
    if not CA_PATH.is_file():
        print("   ⚠️  Homelab CA missing; Collabora SSL verification may fail")
        return False

    if BUNDLE_PATH.is_dir():
        print(
            f"   ⚠️  {BUNDLE_PATH} is a directory (Docker file-mount placeholder); removing..."
        )
        run_cmd("docker compose stop collabora", check=False)
        abs_certs = BUNDLE_PATH.parent.resolve()
        subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "-v",
                f"{abs_certs}:/certs",
                "alpine:3.20",
                "rm",
                "-rf",
                f"/certs/{BUNDLE_NAME}",
            ],
            check=False,
        )
        recreate = True

    if BUNDLE_PATH.is_file() and BUNDLE_PATH.stat().st_mtime >= CA_PATH.stat().st_mtime:
        return recreate

    print("   Building Collabora CA bundle (system CAs + Homelab root)...")
    BUNDLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--entrypoint",
            "cat",
            "collabora/code:latest",
            "/etc/ssl/certs/ca-certificates.crt",
        ],
        capture_output=True,
        check=False,
    )
    system_cas = result.stdout if result.returncode == 0 else b""
    ca_bytes = CA_PATH.read_bytes()
    # Prefer full system store; always include Homelab CA
    if len(system_cas) > 1000:
        content = system_cas.rstrip() + b"\n" + ca_bytes
    else:
        content = ca_bytes

    write_host_file(str(BUNDLE_PATH), content.decode("utf-8"), mode=0o644)
    print(f"   ✅ Wrote {BUNDLE_PATH} ({BUNDLE_PATH.stat().st_size} bytes)")
    return recreate


class CollaboraService(Service):
    name = "collabora"
    volume_dirs = []

    def setup(self, env: dict) -> None:
        super().setup(env)
        print("\n📝 Preparing Collabora secrets...")
        gen_secret("collabora_admin_password", 24)
        print("   ✅ Collabora secrets ready")
        ensure_collabora_ca_bundle()


service = CollaboraService()
