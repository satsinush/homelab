"""Canonical .env keys, defaults, and sync helpers for homelab setup."""
from __future__ import annotations

import os
import re
from pathlib import Path

# Subdomain label for https://<name>.<HOMELAB_HOSTNAME>
SERVICE_URL_NAMES: list[tuple[str, str, str]] = [
    # (env key, default, prompt label)
    ("DASHBOARD_SERVICE_NAME", "dashboard", "Dashboard"),
    ("PIHOLE_SERVICE_NAME", "dns", "Pi-hole"),
    ("DOCKHAND_SERVICE_NAME", "docker", "Dockhand"),
    ("VAULTWARDEN_SERVICE_NAME", "vault", "Vaultwarden"),
    ("GATUS_SERVICE_NAME", "status", "Gatus"),
    ("GOTIFY_SERVICE_NAME", "notify", "Gotify"),
    ("AUTHENTIK_SERVICE_NAME", "auth", "Authentik"),
    ("NEXTCLOUD_SERVICE_NAME", "cloud", "Nextcloud"),
    ("COLLABORA_SERVICE_NAME", "office", "Collabora"),
    ("IMMICH_SERVICE_NAME", "photos", "Immich"),
    ("MAIL_SERVICE_NAME", "mail", "Mail (Stalwart)"),
    ("HEADSCALE_SERVICE_NAME", "vpn", "Headscale (UI slug)"),
]

# Keys managed in .env (template order). Values are defaults used when missing.
# Empty-string defaults are still written; setup fills many at generate time.
ENV_DEFAULTS: dict[str, str] = {
    "TZ": "UTC",
    "HOMELAB_IP_ADDRESS": "127.0.0.1",
    "PUID": "1000",
    "PGID": "1000",
    "PROJECT_ROOT": "",
    "HOMELAB_LANGUAGE": "en",
    "HOMELAB_LOCALE": "en_US",
    "HOMELAB_HOSTNAME": "homelab.home.arpa",
    "DNS_DOMAIN": "home.arpa",
    "TRAEFIK_CERT_RESOLVER": "",
    "ACME_EMAIL": "",
    **{key: default for key, default, _ in SERVICE_URL_NAMES},
    "HOMELAB_DEFAULT_QUOTA_GB": "50",
    "HEADSCALE_BASE_DOMAIN": "ts.home.arpa",
    "HEADSCALE_WEB_HOSTNAME": "vpn.homelab.home.arpa",
    "LAN_SUBNET": "10.10.10.0/24",
    "DOCKER_SUBNET": "10.10.30.0/24",
    "TRAEFIK_IP_ADDRESS": "10.10.30.2",
    "HEADSCALE_IPV4_PREFIX": "100.64.0.0/24",
    "HOST_API_URL": "http://host.docker.internal:5001",
    "HOMELAB_USERNAME": "",
    "HOMELAB_EMAIL": "",
    # Optional — kept if present; not required on fresh install
    "SAMBA_HOST_PORT": "445",
}

# Optional keys: never deleted during sync; only added when missing if set in env.
OPTIONAL_ENV_KEYS = frozenset({"SAMBA_HOST_PORT"})

_VAR_PATTERN = re.compile(
    r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)"
)


def expand_env_template(content: str, environ: dict[str, str] | None = None) -> str:
    """Expand ``$VAR`` / ``${VAR}`` / ``${VAR:-default}`` using environ (or os.environ)."""
    env = environ if environ is not None else os.environ

    def _repl(match: re.Match[str]) -> str:
        braced, default, bare = match.group(1), match.group(2), match.group(3)
        key = braced or bare
        if key in env and env[key] != "":
            return env[key]
        if braced is not None and default is not None:
            return default
        return env.get(key, match.group(0))

    return _VAR_PATTERN.sub(_repl, content)


def render_env_template() -> str:
    """Comment-free .env.template body with ``${KEY:-default}`` placeholders."""
    lines: list[str] = []
    for key, default in ENV_DEFAULTS.items():
        # Quote so values with spaces stay safe after expansion.
        lines.append(f"{key}='${{{key}:-{default}}}'")
    return "\n".join(lines) + "\n"


def write_env_template(path: str | Path = ".env.template") -> None:
    Path(path).write_text(render_env_template(), encoding="utf-8")


def _parse_env_file(path: str | Path) -> dict[str, str]:
    data: dict[str, str] = {}
    p = Path(path)
    if not p.is_file():
        return data
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip("'\"")
        data[key] = val
    return data


def write_env_file(values: dict[str, str], path: str | Path = ".env") -> None:
    """Write .env with managed key order; concrete values (no ${} left)."""
    lines: list[str] = []
    for key in ENV_DEFAULTS:
        if key in OPTIONAL_ENV_KEYS and key not in values:
            continue
        val = values.get(key, ENV_DEFAULTS[key])
        lines.append(f"{key}='{val}'")
    # Preserve unknown keys at the end (user extras) — caller may pass them in values
    known = set(ENV_DEFAULTS)
    for key, val in values.items():
        if key not in known:
            lines.append(f"{key}='{val}'")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def sync_env_file(
    path: str | Path = ".env",
    *,
    updates: dict[str, str] | None = None,
    drop_unknown: bool = False,
) -> dict[str, str]:
    """Ensure .env has all managed keys; fill missing from defaults / updates.

    - Adds missing required keys
    - Applies ``updates`` (overwrite)
    - Optionally drops keys not in ENV_DEFAULTS (except kept unknowns when False)
    """
    current = _parse_env_file(path)
    if updates:
        current.update({k: v for k, v in updates.items() if v is not None})

    for key, default in ENV_DEFAULTS.items():
        if key in OPTIONAL_ENV_KEYS:
            continue
        if not current.get(key):
            # Prefer os.environ if setup already set it
            current[key] = os.environ.get(key) or default

    if drop_unknown:
        current = {k: v for k, v in current.items() if k in ENV_DEFAULTS}

    write_env_file(current, path)
    for key, val in current.items():
        os.environ[key] = val
    return current


def validate_service_name(name: str) -> str | None:
    """Return error message or None if OK (DNS label)."""
    if not re.fullmatch(r"[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?", name):
        return "Use a lowercase DNS label (letters, digits, hyphens; max 63)."
    return None
