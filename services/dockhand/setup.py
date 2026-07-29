"""Dockhand service — Authentik OIDC + local break-glass admin."""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from setup.service import Service, VolumeDir
from setup.ui import info, ok, section, warn
from setup.utils import gen_secret, run_cmd, wait_for

_COOKIE = "/tmp/dockhand-setup.cookies"


def _api(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    cookies: bool = False,
) -> tuple[int, object | None]:
    """Call Dockhand HTTP API from inside the container."""
    hdr = "-H 'Accept: application/json' -H 'Content-Type: application/json'"
    cookie_flags = f"-b {_COOKIE} -c {_COOKIE}" if cookies else ""
    if body is not None:
        b64 = base64.b64encode(json.dumps(body).encode()).decode()
        prep = (
            f"echo {b64} | base64 -d > /tmp/dh-api-req.json && "
            f"curl -sS -o /tmp/dh-api-body -w '%{{http_code}}' -X {method} {hdr} "
            f"{cookie_flags} -d @/tmp/dh-api-req.json 'http://127.0.0.1:3000{path}'"
        )
    else:
        prep = (
            f"curl -sS -o /tmp/dh-api-body -w '%{{http_code}}' -X {method} {hdr} "
            f"{cookie_flags} 'http://127.0.0.1:3000{path}'"
        )
    out = run_cmd(f"docker exec dockhand sh -c {json.dumps(prep)}", check=False) or ""
    out = out.strip()
    if not out:
        return 0, None
    try:
        status = int(out[-3:])
    except ValueError:
        return 0, None
    raw = run_cmd("docker exec dockhand cat /tmp/dh-api-body 2>/dev/null", check=False) or ""
    try:
        return status, json.loads(raw) if raw.strip() else None
    except json.JSONDecodeError:
        return status, raw if raw.strip() else None


def _dockhand_ready() -> bool:
    st, data = _api("GET", "/api/health")
    return st == 200 and isinstance(data, dict) and data.get("status") == "ok"


def _login(username: str, password: str) -> bool:
    run_cmd(f"docker exec dockhand rm -f {_COOKIE}", check=False)
    st, data = _api(
        "POST",
        "/api/auth/login",
        body={"username": username, "password": password},
        cookies=True,
    )
    if st in (200, 201):
        return True
    warn(f"Dockhand login failed ({st}): {data}")
    return False


def _ensure_auth_and_admin(env: dict) -> bool:
    """Ensure break-glass admin exists, enable auth, leave session cookie for OIDC calls."""
    password = Path("./volumes/secrets/dockhand_admin_password").read_text(encoding="utf-8").strip()
    username = "admin"
    host = (env.get("HOMELAB_HOSTNAME") or "homelab.local").strip().strip("'\"")
    email = f"dockhand-admin@{host}"

    st, settings = _api("GET", "/api/auth/settings")
    if st != 200 or not isinstance(settings, dict):
        warn(f"Could not read Dockhand auth settings ({st})")
        return False

    # Dockhand refuses authEnabled=true until at least one user exists.
    st, created = _api(
        "POST",
        "/api/users",
        body={"username": username, "password": password, "email": email},
    )
    if st in (200, 201):
        ok(f"Dockhand local admin created ({username})")
    else:
        info(f"Dockhand admin create skipped ({st})")

    if not settings.get("authEnabled"):
        st, data = _api("PUT", "/api/auth/settings", body={"authEnabled": True})
        if st not in (200, 201):
            warn(f"Could not enable Dockhand auth ({st}): {data}")
            return False
        ok("Dockhand authentication enabled")

    if not _login(username, password):
        warn(
            "Could not log in as Dockhand local admin; "
            "fix password or wipe dockhand/volumes/data and re-run setup"
        )
        return False
    return True


def _ensure_oidc(env: dict) -> None:
    auth = env.get("AUTHENTIK_SERVICE_NAME", "auth")
    host = (env.get("HOMELAB_HOSTNAME") or "homelab.local").strip().strip("'\"")
    svc = env.get("DOCKHAND_SERVICE_NAME", "dockhand")
    issuer = f"https://{auth}.{host}/application/o/dockhand/"
    redirect = f"https://{svc}.{host}/api/auth/oidc/callback"
    secret = Path("./volumes/secrets/dockhand_oidc_secret").read_text(encoding="utf-8").strip()

    desired = {
        "name": "Authentik",
        "enabled": True,
        "issuerUrl": issuer,
        "clientId": "dockhand",
        "clientSecret": secret,
        "redirectUri": redirect,
        "scopes": "openid profile email groups",
        "usernameClaim": "preferred_username",
        "emailClaim": "email",
        "displayNameClaim": "name",
        "adminClaim": "groups",
        "adminValue": "homelab-admins",
    }

    st, existing = _api("GET", "/api/auth/oidc", cookies=True)
    providers: list = []
    if isinstance(existing, list):
        providers = existing
    elif isinstance(existing, dict) and isinstance(existing.get("providers"), list):
        providers = existing["providers"]
    elif st != 200:
        warn(f"Could not list Dockhand OIDC providers ({st}): {existing}")
        return

    match = next(
        (
            p
            for p in providers
            if isinstance(p, dict)
            and (
                p.get("clientId") == "dockhand"
                or p.get("name") == "Authentik"
            )
        ),
        None,
    )

    if match and match.get("id") is not None:
        pid = match["id"]
        st, data = _api("PATCH", f"/api/auth/oidc/{pid}", body=desired, cookies=True)
        if st not in (200, 201):
            st, data = _api("PUT", f"/api/auth/oidc/{pid}", body=desired, cookies=True)
        if st in (200, 201):
            ok(f"Dockhand OIDC updated → {issuer}")
        else:
            warn(f"Dockhand OIDC update failed ({st}): {data}")
        return

    st, data = _api("POST", "/api/auth/oidc", body=desired, cookies=True)
    if st in (200, 201):
        ok(f"Dockhand OIDC → {issuer} (admins: homelab-admins)")
    else:
        warn(f"Dockhand OIDC create failed ({st}): {data}")


class DockhandService(Service):
    name = "dockhand"
    volume_dirs = [
        VolumeDir("./services/dockhand/volumes/data", mode=0o755),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Dockhand secrets...", emoji="🔐")
        os.makedirs("./volumes/secrets", exist_ok=True)
        gen_secret("dockhand_oidc_secret", 64)
        gen_secret("dockhand_admin_password", 32)

    def postsetup(self, env: dict) -> None:
        section("Configuring Dockhand OIDC (Authentik)...", emoji="🔑")
        if not wait_for(_dockhand_ready, timeout=120, interval=5):
            warn("Dockhand not ready; skip OIDC")
            return
        if not _ensure_auth_and_admin(env):
            return
        _ensure_oidc(env)
        run_cmd(f"docker exec dockhand rm -f {_COOKIE}", check=False)
        host = (env.get("HOMELAB_HOSTNAME") or "homelab.local").strip().strip("'\"")
        svc = env.get("DOCKHAND_SERVICE_NAME", "dockhand")
        info(
            f"SSO: https://{svc}.{host} (Authentik button). "
            "Break-glass local admin: volumes/secrets/dockhand_admin_password"
        )


service = DockhandService()
