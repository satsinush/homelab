"""Immich service — volumes, secrets, first admin + OIDC."""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from setup.service import (
    Service,
    VolumeDir,
    latest_file,
    pg_dump_to_file,
    pg_restore_from_file,
)
from setup.ui import ok, warn
from setup.utils import append_env, authentik_group_usernames, gen_secret, run_cmd, wait_for

# Bump when Immich requires a different DB image / incompatible data dir.
_DB_ENGINE = "vectorchord-pg14"
_DB_ENGINE_MARKER = Path("./services/immich/volumes/.db-engine")
_DB_DIR = Path("./services/immich/volumes/db")


def _ensure_db_engine() -> None:
    """Reset Postgres data when upgrading off legacy pgvecto.rs (Immich v3)."""
    previous = (
        _DB_ENGINE_MARKER.read_text(encoding="utf-8").strip()
        if _DB_ENGINE_MARKER.is_file()
        else ""
    )
    has_data = _DB_DIR.is_dir() and any(_DB_DIR.iterdir())
    if previous == _DB_ENGINE:
        return
    if has_data:
        warn(
            "Resetting Immich Postgres for VectorChord (Immich v3+) — "
            "upload library volume is kept; re-run postsetup for admin/OIDC"
        )
        run_cmd("docker compose stop immich-server immich-machine-learning immich-postgres", check=False)
        shutil.rmtree(_DB_DIR, ignore_errors=True)
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    _DB_ENGINE_MARKER.parent.mkdir(parents=True, exist_ok=True)
    _DB_ENGINE_MARKER.write_text(_DB_ENGINE + "\n", encoding="utf-8")
    try:
        os.chown(_DB_DIR, 999, 999)
    except OSError:
        pass


def _api(method: str, path: str, token: str | None = None, body: dict | None = None) -> tuple[int, dict | list | None]:
    """Call Immich HTTP API from inside the server container."""
    hdr = "-H 'Accept: application/json' -H 'Content-Type: application/json'"
    if token:
        hdr += f" -H 'Authorization: Bearer {token}'"
    if body is not None:
        b64 = __import__("base64").b64encode(json.dumps(body).encode()).decode()
        prep = (
            f"echo {b64} | base64 -d > /tmp/immich-api-req.json && "
            f"curl -sS -o /tmp/immich-api-body -w '%{{http_code}}' -X {method} {hdr} "
            f"-d @/tmp/immich-api-req.json 'http://127.0.0.1:2283{path}'"
        )
    else:
        prep = (
            f"curl -sS -o /tmp/immich-api-body -w '%{{http_code}}' -X {method} {hdr} "
            f"'http://127.0.0.1:2283{path}'"
        )
    out = run_cmd(f"docker exec immich-server sh -c {json.dumps(prep)}", check=False) or ""
    out = out.strip()
    if not out:
        return 0, None
    try:
        status = int(out[-3:])
    except ValueError:
        return 0, None
    raw = run_cmd(
        "docker exec immich-server cat /tmp/immich-api-body 2>/dev/null",
        check=False,
    ) or ""
    try:
        return status, json.loads(raw) if raw.strip() else None
    except json.JSONDecodeError:
        return status, None


def _immich_up() -> bool:
    status, data = _api("GET", "/api/server/features")
    return status == 200 and isinstance(data, dict)


def _admin_exists() -> bool:
    """True once first-time admin registration is no longer available."""
    status, _ = _api("POST", "/api/auth/admin-sign-up", body={})
    # 400 validation / 403 already initialized — both mean "not open" or bad body.
    # Fresh install returns 400 with validation errors when body empty; use list-users.
    out = run_cmd("docker exec immich-server immich-admin list-users", check=False) or ""
    return "email:" in out or "'email'" in out or '"email"' in out


def _login(email: str, password: str) -> str | None:
    status, data = _api(
        "POST",
        "/api/auth/login",
        body={"email": email, "password": password},
    )
    if status == 201 and isinstance(data, dict):
        return data.get("accessToken")
    return None


def _ensure_admin(env: dict) -> str | None:
    """Create/reclaim local break-glass admin (not HOMELAB_USERNAME)."""
    hostname = (env.get("HOMELAB_HOSTNAME") or "homelab.local").strip().strip("'\"")
    email = f"admin@{hostname}"
    name = "admin"
    pw_path = Path("./volumes/secrets/immich_admin_password")
    if not pw_path.is_file():
        warn("immich_admin_password missing; skip Immich admin")
        return None
    password = pw_path.read_text(encoding="utf-8").strip()

    token = _login(email, password)
    if token:
        return token

    if not _admin_exists():
        status, data = _api(
            "POST",
            "/api/auth/admin-sign-up",
            body={"email": email, "password": password, "name": name},
        )
        if status in (200, 201):
            return _login(email, password)
        warn(f"Immich admin-sign-up failed ({status}): {data}")
        return None

    # Admin exists (e.g. prior HOMELAB_USERNAME bootstrap) — reset + rename to admin@.
    import subprocess

    reset = subprocess.run(
        ["docker", "exec", "-i", "immich-server", "immich-admin", "reset-admin-password"],
        input=password + "\n",
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    reset_out = (reset.stdout or "") + (reset.stderr or "")
    if "updated" not in reset_out.lower() and reset.returncode != 0:
        warn("Could not reset Immich admin password; configure manually")
        warn(reset_out[:400])
        return None

    users_out = run_cmd("docker exec immich-server immich-admin list-users", check=False) or ""
    admin_email = None
    for line in users_out.splitlines():
        if "email:" in line.lower() or "'email'" in line or '"email"' in line:
            part = line.split(":", 1)[-1].strip().rstrip(",").strip().strip("'\"")
            if "@" in part:
                admin_email = part
                break
    if not admin_email:
        admin_email = email

    token = _login(admin_email, password)
    if not token:
        warn(f"Login after password reset failed for {admin_email}")
        return None

    status, me = _api("GET", "/api/users/me", token=token)
    if status != 200 or not isinstance(me, dict):
        warn("Could not load Immich /users/me after reset")
        return token

    status, _ = _api(
        "PUT",
        "/api/users/me",
        token=token,
        body={"email": email, "name": name},
    )
    if status in (200, 201):
        return _login(email, password) or token

    warn(f"Could not rename Immich admin to {email} ({status}); OIDC config may still work")
    return token


def _ensure_oauth(env: dict, token: str) -> None:
    auth = env.get("AUTHENTIK_SERVICE_NAME", "auth")
    host = env.get("HOMELAB_HOSTNAME", "homelab.local")
    issuer = f"https://{auth}.{host}/application/o/immich/"
    secret = Path("./volumes/secrets/immich_oidc_secret").read_text(encoding="utf-8").strip()
    try:
        quota_gb = int(str(env.get("HOMELAB_DEFAULT_QUOTA_GB") or "50").strip() or "50")
    except ValueError:
        quota_gb = 50

    status, cfg = _api("GET", "/api/system-config", token=token)
    if status != 200 or not isinstance(cfg, dict):
        warn(f"Could not read Immich system-config ({status})")
        # Fallback: toggle only
        run_cmd("docker exec immich-server immich-admin enable-oauth-login", check=False)
        return

    oauth = dict(cfg.get("oauth") or {})
    oauth["enabled"] = True
    oauth["issuerUrl"] = issuer
    oauth["clientId"] = "immich"
    oauth["clientSecret"] = secret
    # Authentik "immich" scope → immich_quota / immich_role at user creation.
    oauth["scope"] = "openid email profile immich"
    oauth["buttonText"] = "Authentik"
    oauth["autoRegister"] = True
    oauth["autoLaunch"] = False
    oauth["storageQuotaClaim"] = "immich_quota"
    oauth["roleClaim"] = "immich_role"
    # No claim → unlimited (admins omit immich_quota). Non-admins get claim GiB.
    oauth["defaultStorageQuota"] = None
    if "signingAlgorithm" in oauth:
        oauth["signingAlgorithm"] = oauth.get("signingAlgorithm") or "RS256"
    # Private CA: Immich must skip TLS verify for Authentik discovery when set.
    if "allowInsecureRequests" in oauth:
        oauth["allowInsecureRequests"] = True

    cfg["oauth"] = oauth
    status, data = _api("PUT", "/api/system-config", token=token, body=cfg)
    if status not in (200, 201):
        warn(f"system-config OAuth update failed ({status}): {data}")
        run_cmd("docker exec immich-server immich-admin enable-oauth-login", check=False)
        return

    # Backfill existing users (claims apply only at Immich account creation).
    _ensure_user_quotas(token, quota_gb, env)


def _ensure_user_quotas(token: str, quota_gb: int, env: dict) -> None:
    """Backfill quotas: 50 GiB for users, unlimited for Immich/Authentik admins."""
    status, users = _api("GET", "/api/admin/users", token=token)
    if status != 200 or not isinstance(users, list):
        warn(f"Could not list Immich users for quota backfill ({status})")
        return
    quota_bytes = quota_gb * 1024 * 1024 * 1024
    ak_admins = {n.lower() for n in authentik_group_usernames("homelab-admins")}
    homelab_user = (env.get("HOMELAB_USERNAME") or "").strip().lower()
    if homelab_user:
        ak_admins.add(homelab_user)
    host = (env.get("HOMELAB_HOSTNAME") or "").strip().lower()

    limited = 0
    unlimited = 0
    for user in users:
        if not isinstance(user, dict):
            continue
        uid = user.get("id")
        if not uid:
            continue
        email = (user.get("email") or "").lower()
        name = (user.get("name") or "").lower()
        local = email.split("@", 1)[0] if "@" in email else ""
        is_admin = bool(user.get("isAdmin")) or name in ak_admins or local in ak_admins
        if host and email == f"{homelab_user}@{host}":
            is_admin = True

        if is_admin:
            body: dict = {"quotaSizeInBytes": None}
            # Keep Authentik homelab-admins aligned as Immich admins (except when
            # already the break-glass admin@ account).
            if not user.get("isAdmin") and (name in ak_admins or local in ak_admins):
                body["isAdmin"] = True
            desired_quota = None
        else:
            body = {"quotaSizeInBytes": quota_bytes}
            desired_quota = quota_bytes

        if user.get("quotaSizeInBytes") == desired_quota and (
            not body.get("isAdmin") or user.get("isAdmin")
        ):
            if is_admin:
                unlimited += 1
            else:
                limited += 1
            continue

        st, _ = _api("PUT", f"/api/admin/users/{uid}", token=token, body=body)
        if st in (200, 201):
            if is_admin:
                unlimited += 1
            else:
                limited += 1
        else:
            warn(f"Immich quota update failed for {email or uid} ({st})")


def configure_immich(env: dict) -> None:
    if not wait_for(_immich_up, timeout=180, interval=5):
        warn("Immich not ready; skip admin/OIDC")
        return
    token = _ensure_admin(env)
    if not token:
        warn("No Immich admin token; skip OIDC wiring")
        return
    _ensure_oauth(env, token)
    ok("Immich configured")


class ImmichService(Service):
    name = "immich"
    volume_dirs = [
        VolumeDir("./services/immich/volumes/upload", mode=0o755),
        VolumeDir("./services/immich/volumes/model-cache", mode=0o755),
        VolumeDir("./services/immich/volumes/db", uid=999, gid=999, mode=0o700),
        VolumeDir("./services/immich/volumes/db-dumps", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        gen_secret("immich_db_password", 32)
        gen_secret("immich_oidc_secret", 32)
        gen_secret("immich_admin_password", 32)
        pw = Path("./volumes/secrets/immich_db_password").read_text(encoding="utf-8").strip()
        oidc = Path("./volumes/secrets/immich_oidc_secret").read_text(encoding="utf-8").strip()
        append_env(env, "IMMICH_DB_PASSWORD", pw)
        append_env(env, "IMMICH_OIDC_SECRET", oidc)
        if not env.get("IMMICH_SERVICE_NAME"):
            append_env(env, "IMMICH_SERVICE_NAME", "photos")
        if not env.get("IMMICH_VERSION"):
            append_env(env, "IMMICH_VERSION", "v3")
        _ensure_db_engine()

    def postsetup(self, env: dict) -> None:
        try:
            configure_immich(env)
        except Exception as exc:
            warn(f"Immich auto-configure failed: {exc}")

    def backup(self, env: dict) -> None:
        # Live Postgres dir is restic-excluded; dump into db-dumps for upload.
        dest = "./services/immich/volumes/db-dumps/immich-backup.sql"
        pg_dump_to_file(
            "immich-postgres",
            "immich",
            "immich",
            dest,
            password_file="/run/secrets/immich_db_password",
        )

    def restore(self, env: dict) -> None:
        dump = latest_file("./services/immich/volumes/db-dumps", ".sql")
        if dump:
            pg_restore_from_file(
                "immich-postgres",
                "immich",
                "immich",
                dump,
                password_file="/run/secrets/immich_db_password",
            )


service = ImmichService()
