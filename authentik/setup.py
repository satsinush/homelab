"""Authentik service — volumes, Postgres dump/restore."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from setup.service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import info, ok, section, warn
from setup.utils import gen_secret, run_cmd

_ICON_SRC = Path("./dashboard/frontend/public/homelab-icon.svg")
_ICONS_SRC = Path("./dashboard/frontend/src/assets")
_MEDIA_PUBLIC = Path("./authentik/volumes/media/public")


def sync_authentik_branding_assets() -> None:
    """Copy branding icons into the media volume (no nested Docker file mounts).

    Nested bind-mounts under ``/media`` break on Docker Desktop/WSL: Docker
    creates a 0-byte host placeholder, then fails with ``file exists`` on restart.
    """
    dest_public = _MEDIA_PUBLIC
    dest_public.mkdir(parents=True, exist_ok=True)
    dest_icons = dest_public / "icons"
    dest_icons.mkdir(parents=True, exist_ok=True)

    if _ICON_SRC.is_file():
        shutil.copy2(_ICON_SRC, dest_public / "homelab-icon.svg")
    else:
        warn(f"Missing branding icon: {_ICON_SRC}")

    if _ICONS_SRC.is_dir():
        for src in _ICONS_SRC.iterdir():
            if src.is_file():
                shutil.copy2(src, dest_icons / src.name)
    else:
        warn(f"Missing icons directory: {_ICONS_SRC}")


def _ak_shell(script: str) -> str:
    """Run a Python snippet in ``ak shell`` via stdin (supports real newlines)."""
    res = subprocess.run(
        ["docker", "exec", "-i", "authentik-worker", "ak", "shell"],
        input=script,
        text=True,
        capture_output=True,
        check=False,
    )
    out = (res.stdout or "").strip()
    if res.returncode != 0 and not out:
        return (res.stderr or "").strip()
    return out


class AuthentikService(Service):
    name = "authentik"
    volume_dirs = [
        VolumeDir("./authentik/volumes/media", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/media/public/icons", uid=1000, gid=1000, mode=0o755),
        VolumeDir("./authentik/volumes/templates", mode=0o755),
        VolumeDir("./authentik/volumes/certs", mode=0o755),
        VolumeDir("./authentik/volumes/db", uid=70, gid=70, mode=0o700),
        VolumeDir("./authentik/volumes/db-dumps", mode=0o700),
        VolumeDir("./authentik/volumes/redis", uid=999, gid=999, mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Authentik volumes and secrets...", emoji="🔑")
        gen_secret("authentik_secret_key", 50)
        gen_secret("authentik_pg_pass", 32)
        gen_secret("authentik_akadmin_password", 32)
        gen_secret("ldap_service_password", 32)
        # Placeholder until postsetup copies the real Outpost token from Authentik.
        gen_secret("ldap_outpost_token", 40)
        gen_secret("nextcloud_oidc_secret", 32)
        gen_secret("immich_oidc_secret", 32)
        # SMB password sync from Authentik expression policy → host-api
        gen_secret("host_api_token", 32)
        sync_authentik_branding_assets()
        ok("Authentik volume directories ready")

    def postsetup(self, env: dict) -> None:
        """Ensure LDAP app/provider/outpost exist, then sync the outpost token."""
        info(
            "LDAP outpost: ensure Outpost 'LDAP Outpost' is healthy. "
            "If authentik-ldap fails auth, copy its token from Authentik Admin → "
            "Outposts → LDAP Outpost into volumes/secrets/ldap_outpost_token and "
            "recreate authentik-ldap."
        )
        # Blueprint can race; heal idempotently. Markers only — never log the token.
        ensure_res = _ak_shell(
            """
from authentik.providers.ldap.api import LDAPProviderSerializer
from authentik.providers.ldap.models import LDAPProvider
from authentik.core.models import Application
from authentik.outposts.models import Outpost, OutpostType
from authentik.flows.models import Flow

authn = Flow.objects.get(slug="default-authentication-flow")
inval = Flow.objects.get(slug="default-provider-invalidation-flow")
app, _ = Application.objects.get_or_create(slug="ldap", defaults={"name": "LDAP"})
app.name = "LDAP"
app.meta_hide = True
app.save()

p = LDAPProvider.objects.filter(name="LDAP").first()
if not p:
    s = LDAPProviderSerializer(
        data={
            "name": "LDAP",
            "authentication_flow": str(authn.pk),
            "authorization_flow": str(authn.pk),
            "invalidation_flow": str(inval.pk),
            "bind_mode": "cached",
            "search_mode": "cached",
            "base_dn": "dc=ldap,dc=goauthentik,dc=io",
            "uid_start_number": 2000,
            "gid_start_number": 4000,
            "mfa_support": False,
        }
    )
    assert s.is_valid(), s.errors
    p = s.save()
else:
    p.authentication_flow = authn
    p.authorization_flow = authn
    p.invalidation_flow = inval
    p.save()

app.backchannel_providers.set([p])
op, _ = Outpost.objects.get_or_create(
    name="LDAP Outpost", defaults={"type": OutpostType.LDAP}
)
op.type = OutpostType.LDAP
op.save()
op.providers.set([p])
print("ldap-ready")
token = getattr(getattr(op, "token", None), "key", "") or ""
print("ldap-token:" + token)
"""
        )
        if "ldap-ready" in ensure_res:
            ok("LDAP provider, application, and outpost ready")
        else:
            warn(
                "Could not ensure LDAP objects via ak shell; "
                "blueprint/manual setup may be needed"
            )

        token = ""
        for line in ensure_res.splitlines():
            line = line.strip()
            if line.startswith("ldap-token:"):
                token = line[len("ldap-token:") :].strip()
                break
        if token and len(token) >= 20:
            path = Path("./volumes/secrets/ldap_outpost_token")
            path.write_text(token + "\n", encoding="utf-8")
            path.chmod(0o600)
            ok("Wrote LDAP outpost token from Authentik")
            run_cmd(
                "docker compose --env-file .env up -d --force-recreate authentik-ldap",
                check=False,
            )
        else:
            warn("Could not auto-extract LDAP outpost token; set it manually if needed")

    def backup(self, env: dict) -> None:
        dest = "./authentik/volumes/db-dumps/authentik-backup.sql"
        user = env.get("AUTHENTIK_PG_USER", "authentik")
        db = env.get("AUTHENTIK_PG_DB", "authentik")
        pg_dump_to_file(
            "authentik-postgres",
            db,
            user,
            dest,
            password_file="/run/secrets/authentik_pg_pass",
        )

    def restore(self, env: dict) -> None:
        dump = latest_file("./authentik/volumes/db-dumps", ".sql")
        if dump:
            user = env.get("AUTHENTIK_PG_USER", "authentik")
            db = env.get("AUTHENTIK_PG_DB", "authentik")
            pg_restore_from_file(
                "authentik-postgres",
                db,
                user,
                dump,
                password_file="/run/secrets/authentik_pg_pass",
            )


service = AuthentikService()
