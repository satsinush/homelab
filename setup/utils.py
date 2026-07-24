"""Shared utilities for homelab setup scripts."""
from __future__ import annotations

import getpass
import json
import os
import secrets
import shutil
import subprocess
import time
from collections.abc import Callable
from pathlib import Path

from setup.ui import info, ok, step, warn


def prompt_nonempty(
    label: str,
    *,
    default: str | None = None,
    validate: Callable[[str], str | None] | None = None,
) -> str:
    """Prompt until a non-empty value is entered (or default is accepted).

    validate(value) should return None if OK, or an error message string.
    """
    while True:
        value = input(label).strip()
        if not value and default is not None:
            value = default
        if not value:
            warn("Value required.")
            continue
        if validate is not None:
            err = validate(value)
            if err:
                warn(err)
                continue
        return value


def prompt_secret(label: str) -> str:
    """Prompt for a secret (no echo) until non-empty."""
    while True:
        value = getpass.getpass(label).strip()
        if value:
            return value
        warn("Value required.")


def prompt_password(
    label: str = "   Password: ",
    *,
    confirm: bool = False,
    confirm_label: str = "   Confirm Password: ",
    min_length: int = 0,
) -> str:
    """Prompt for a password; optionally require confirmation and a minimum length."""
    while True:
        password = getpass.getpass(label).strip()
        if not password:
            warn("Value required.")
            continue
        if min_length and len(password) < min_length:
            warn(f"Use at least {min_length} characters.")
            continue
        if confirm:
            again = getpass.getpass(confirm_label).strip()
            if password != again:
                warn("Passwords do not match. Try again.")
                continue
        return password


def prompt_yes_no(label: str, *, default: bool | None = None) -> bool:
    """Prompt for y/n. If default is set, empty input uses that default."""
    while True:
        answer = input(label).strip().lower()
        if not answer and default is not None:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        warn("Please answer with y or n.")


def run_cmd(cmd, cwd=None, shell=True, check=True, capture=True):
    """Run a shell command.

    When capture=True (default), return stripped stdout and print stderr/stdout only on
    failure. When capture=False, stream child stdout/stderr to this process (useful for
    `docker compose build` / `up`).
    """
    try:
        if capture:
            res = subprocess.run(
                cmd,
                cwd=cwd,
                shell=shell,
                check=check,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            return res.stdout.strip()
        subprocess.run(cmd, cwd=cwd, shell=shell, check=check)
        return ""
    except subprocess.CalledProcessError as e:
        if capture:
            print(f"Error running command: {cmd}\nOutput: {e.stdout}\nError: {e.stderr}")
        else:
            print(f"Error running command: {cmd} (exit {e.returncode})")
        if check:
            import sys
            sys.exit(1)
        return None


def docker_exec(container: str, *args: str, check: bool = True) -> str:
    """Run `docker exec <container> …` and return stripped stdout (or '')."""
    import shlex

    quoted = " ".join(shlex.quote(a) for a in args)
    return run_cmd(f"docker exec {shlex.quote(container)} {quoted}", check=check) or ""


def compose_up(
    *services: str,
    profiles: tuple[str, ...] | list[str] = (),
    force_recreate: bool = False,
    check: bool = True,
) -> str | None:
    """`docker compose [--profile …] up -d [--force-recreate] [--remove-orphans] [services…]`."""
    parts = ["docker", "compose"]
    for profile in profiles:
        parts.extend(["--profile", profile])
    parts.extend(["up", "-d", "--remove-orphans"])
    if force_recreate:
        parts.append("--force-recreate")
    parts.extend(services)
    return run_cmd(" ".join(parts), check=check, capture=False)


def append_env(env: dict, key: str, value: str, path: str = ".env") -> None:
    """Append KEY='value' to .env and update env + os.environ."""
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"\n{key}='{value}'\n")
    env[key] = value
    os.environ[key] = value


def wait_for(
    predicate: Callable[[], bool],
    *,
    timeout: float = 120,
    interval: float = 2,
) -> bool:
    """Poll predicate until True or timeout. Returns whether it succeeded."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def wait_for_container_healthy(name: str, timeout: float = 120) -> bool:
    """Wait until docker inspect reports Health.Status == healthy."""

    def _healthy() -> bool:
        status = run_cmd(
            f'docker inspect -f "{{{{.State.Health.Status}}}}" {name} 2>/dev/null',
            check=False,
        )
        return (status or "").strip() == "healthy"

    return wait_for(_healthy, timeout=timeout, interval=2)


def detect_host_api_url(port: int = 5001) -> str:
    """URL containers use to reach host-api on this machine.

    On Docker Desktop + WSL2, ``host.docker.internal`` often reaches the Windows
    Docker VM (or another host), not the WSL distro where host-api listens.
    Prefer this machine's primary non-loopback IP so dashboard ↔ host-api stays
    on the same host. Override with HOST_API_URL when needed.
    """
    override = (os.environ.get("HOST_API_URL") or "").strip().rstrip("/")
    if override:
        return override
    try:
        out = subprocess.check_output(
            ["hostname", "-I"], text=True, timeout=5
        ).strip()
        for ip in out.split():
            if ip and not ip.startswith("127.") and ":" not in ip:
                return f"http://{ip}:{port}"
    except (subprocess.SubprocessError, OSError, FileNotFoundError):
        pass
    return f"http://host.docker.internal:{port}"


def gen_secret(name, length_bytes):
    """Generate a secret file in ./volumes/secrets/ if it doesn't already exist.

    Files stay mode 0600 under a 0700 directory. Compose bind-mounts keep host
    ownership, so non-root containers get read via ACLs (see
    ensure_secrets_container_access). No trailing newline so file:// / *_FILE
    readers match Postgres.
    """
    os.makedirs("./volumes/secrets", exist_ok=True)
    try:
        os.chmod("./volumes/secrets", 0o700)
    except OSError:
        pass
    path = f"./volumes/secrets/{name}"
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        val = secrets.token_hex(length_bytes)
        with open(path, "w", encoding="utf-8") as f:
            f.write(val)
        step(f"Generated {name}")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


# Container UIDs that must read Compose file-secrets (bind-mounted with host mode).
_SECRET_READER_UIDS = (
    1000,  # Authentik server (worker uses user: root for docker.sock)
    2000,  # Stalwart
)


def ensure_secrets_container_access() -> None:
    """Keep secrets 0600; grant specific container UIDs read via POSIX ACL.

    World-readable (0444) would work but exposes secrets to every host user.
    Compose does not remap secret ownership outside Swarm, so ACLs are the
    least-privilege fix when apps run as non-root.
    """
    secrets_dir = "./volumes/secrets"
    if not os.path.isdir(secrets_dir):
        return

    stripped_n = 0
    for name in sorted(os.listdir(secrets_dir)):
        path = os.path.join(secrets_dir, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "rb") as f:
                data = f.read()
            stripped = data.rstrip(b"\r\n")
            if stripped != data:
                with open(path, "wb") as f:
                    f.write(stripped)
                stripped_n += 1
            os.chmod(path, 0o600)
        except OSError as e:
            warn(f"Could not normalize {path}: {e}")

    if stripped_n:
        ok(f"Stripped trailing newlines from {stripped_n} secret file(s)")

    if not shutil.which("setfacl"):
        warn("setfacl not found — install the 'acl' package so non-root")
        print("      containers (Authentik UID 1000) can read 0600 secrets.")
        print("      Until then, Authentik may fail with Permission denied on /run/secrets.")
        return

    # Default ACL on the directory so newly generated secrets inherit reader access.
    uids = ",".join(f"u:{uid}:r" for uid in _SECRET_READER_UIDS)
    duids = ",".join(f"d:u:{uid}:r" for uid in _SECRET_READER_UIDS)
    try:
        subprocess.run(
            ["setfacl", "-m", f"{uids},{duids}", secrets_dir],
            check=False,
            capture_output=True,
        )
    except OSError as e:
        warn(f"setfacl on {secrets_dir} failed: {e}")
        return

    for name in sorted(os.listdir(secrets_dir)):
        path = os.path.join(secrets_dir, name)
        if not os.path.isfile(path):
            continue
        subprocess.run(
            ["setfacl", "-m", uids, path],
            check=False,
            capture_output=True,
        )

    ok(
        "Secrets remain mode 0600; ACL read granted for UID(s) "
        + ", ".join(str(u) for u in _SECRET_READER_UIDS)
    )


def load_env(path=".env"):
    """Load a .env file into os.environ and return the dict."""
    env_vars = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        k, v = parts[0].strip(), parts[1].strip()
                        # strip quotes if present
                        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
                            v = v[1:-1]
                        env_vars[k] = v
                        os.environ[k] = v
    return env_vars


def load_secrets():
    """Load all secret files from ./volumes/secrets/ into os.environ."""
    secrets_dir = "./volumes/secrets"
    if os.path.exists(secrets_dir):
        for name in os.listdir(secrets_dir):
            path = os.path.join(secrets_dir, name)
            if os.path.isfile(path):
                varname = name.upper()
                with open(path) as f:
                    val = f.read().strip()
                os.environ[varname] = val


def container_curl(container, method, url, data=None, headers=None, auth=None):
    """Execute a curl command inside a running Docker container."""
    headers = headers or {}
    cmd = ["docker", "exec", "-i", container, "curl", "-s", "-k", "-w", "\\n%{http_code}", "-X", method]
    for k, v in headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if auth:
        cmd += ["-u", auth]
    if data:
        cmd += ["--data-binary", "@-"]
    cmd.append(url)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE if data else None, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(input=data)

    lines = stdout.strip().split("\n")
    if not lines or len(lines) < 2:
        return "", 0
    status_code = int(lines[-1])
    body = "\n".join(lines[:-1])
    return body, status_code


def network_curl(network, method, url, data=None, headers=None):
    """Run curl on a Docker network (for services without curl in their image)."""
    headers = headers or {}
    cmd = [
        "docker", "run", "--rm", "-i", "--network", network,
        "curlimages/curl:8.5.0",
        "-s", "-k", "-w", "\\n%{http_code}", "-X", method,
    ]
    for k, v in headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if data:
        cmd += ["--data-binary", "@-"]
    cmd.append(url)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE if data else None, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(input=data)

    lines = stdout.strip().split("\n")
    if not lines or len(lines) < 2:
        if stderr.strip():
            warn(f"network_curl failed: {stderr.strip()}")
        return "", 0
    status_code = int(lines[-1])
    body = "\n".join(lines[:-1])
    return body, status_code


def wait_for_containers(timeout=300, exclude: set[str] | frozenset[str] | None = None):
    """Wait for Docker Compose containers to be running and healthy.

    exclude: container Name or Service names to skip (rarely needed).
    """
    skip = {n.lower() for n in (exclude or ())}
    step("Waiting for all containers to be running and healthy...")
    if skip:
        step(f"(excluding until postsetup: {', '.join(sorted(skip))})")
    start_time = time.time()

    while time.time() - start_time < timeout:
        stdout = run_cmd("docker compose ps --format json", check=False)
        if not stdout:
            time.sleep(2)
            continue

        containers = []
        for line in stdout.strip().split("\n"):
            line = line.strip()
            if line:
                try:
                    if line.startswith("[") and line.endswith("]"):
                        containers.extend(json.loads(line))
                    else:
                        containers.append(json.loads(line))
                except Exception:
                    pass

        if not containers:
            time.sleep(2)
            continue

        all_ok = True
        starting_or_unhealthy = []

        for c in containers:
            name = c.get("Name", c.get("Service", "unknown"))
            service = c.get("Service", "")
            state = c.get("State", "").lower()
            health = c.get("Health", "").lower()

            if state in ["exited", "stopped"] and name == "setup":
                continue
            if name.lower() in skip or service.lower() in skip:
                continue

            if state != "running":
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({state})")
                continue

            if health and health not in ["healthy", "none"]:
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({health})")

        if all_ok:
            # Finish/clear the in-place status line (ANSI clear is flaky in some WSL TTYs).
            _clear_status_line()
            step("All containers are running and healthy! 🎉")
            return True

        elapsed = int(time.time() - start_time)
        msg = f"   [{elapsed}s] Still waiting for: {', '.join(starting_or_unhealthy[:4])}..."
        _print_status_line(msg)
        time.sleep(2)

    _clear_status_line()
    warn("Timeout reached. Proceeding with configuration anyway...")
    return False


def _print_status_line(msg: str) -> None:
    """Overwrite the current terminal line with msg (no trailing newline)."""
    width = shutil.get_terminal_size((120, 20)).columns
    # Pad/truncate so a longer previous status cannot leak past the end.
    body = msg[: width - 1].ljust(width - 1)
    print(f"\r{body}", end="", flush=True)


def _clear_status_line() -> None:
    """Erase an in-place status line and move to a fresh line."""
    width = shutil.get_terminal_size((120, 20)).columns
    print("\r" + (" " * max(width - 1, 1)) + "\r", end="", flush=True)


def substitute_env_vars(content):
    """Replace $VAR or ${VAR} expressions in content with values from os.environ."""
    import os
    return os.path.expandvars(content)


# Explicit TZ → ISO 3166-1 phone region (extend as needed).
_PHONE_REGION_BY_TZ: dict[str, str] = {
    "America/New_York": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Phoenix": "US",
    "America/Los_Angeles": "US",
    "America/Anchorage": "US",
    "Pacific/Honolulu": "US",
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "America/Edmonton": "CA",
    "America/Winnipeg": "CA",
    "America/Halifax": "CA",
    "America/St_Johns": "CA",
    "America/Mexico_City": "MX",
    "America/Tijuana": "MX",
    "Europe/London": "GB",
    "Europe/Dublin": "IE",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE",
    "Europe/Madrid": "ES",
    "Europe/Rome": "IT",
    "Europe/Zurich": "CH",
    "Europe/Vienna": "AT",
    "Europe/Stockholm": "SE",
    "Europe/Oslo": "NO",
    "Europe/Copenhagen": "DK",
    "Europe/Helsinki": "FI",
    "Europe/Warsaw": "PL",
    "Europe/Prague": "CZ",
    "Europe/Athens": "GR",
    "Europe/Lisbon": "PT",
    "Australia/Sydney": "AU",
    "Australia/Melbourne": "AU",
    "Australia/Perth": "AU",
    "Pacific/Auckland": "NZ",
    "Asia/Tokyo": "JP",
    "Asia/Seoul": "KR",
    "Asia/Shanghai": "CN",
    "Asia/Hong_Kong": "HK",
    "Asia/Singapore": "SG",
    "Asia/Kolkata": "IN",
    "Asia/Dubai": "AE",
    "America/Sao_Paulo": "BR",
    "America/Argentina/Buenos_Aires": "AR",
}


def phone_region_from_tz(tz_name: str) -> str:
    """Best-effort ISO 3166-1 region from IANA timezone."""
    if tz_name in _PHONE_REGION_BY_TZ:
        return _PHONE_REGION_BY_TZ[tz_name]
    if tz_name.startswith("America/"):
        return "US"
    if tz_name.startswith("Europe/"):
        return "DE"
    if tz_name.startswith("Australia/"):
        return "AU"
    if tz_name.startswith("Pacific/"):
        return "US"
    if tz_name.startswith("Asia/"):
        return "JP"
    return "US"


# ISO 3166-1 region → (Nextcloud language, locale). Used when host LANG is unset/C.
_LOCALE_BY_REGION = {
    "US": ("en", "en_US"),
    "CA": ("en", "en_CA"),
    "MX": ("es", "es_MX"),
    "GB": ("en", "en_GB"),
    "IE": ("en", "en_IE"),
    "FR": ("fr", "fr_FR"),
    "DE": ("de", "de_DE"),
    "NL": ("nl", "nl_NL"),
    "BE": ("nl", "nl_BE"),
    "ES": ("es", "es_ES"),
    "IT": ("it", "it_IT"),
    "CH": ("de", "de_CH"),
    "AT": ("de", "de_AT"),
    "SE": ("sv", "sv_SE"),
    "NO": ("nb", "nb_NO"),
    "DK": ("da", "da_DK"),
    "FI": ("fi", "fi_FI"),
    "PL": ("pl", "pl_PL"),
    "CZ": ("cs", "cs_CZ"),
    "GR": ("el", "el_GR"),
    "PT": ("pt", "pt_PT"),
    "AU": ("en", "en_AU"),
    "NZ": ("en", "en_NZ"),
    "JP": ("ja", "ja_JP"),
    "KR": ("ko", "ko_KR"),
    "CN": ("zh", "zh_CN"),
    "HK": ("zh", "zh_HK"),
    "SG": ("en", "en_SG"),
    "IN": ("en", "en_IN"),
    "AE": ("en", "en_AE"),
    "BR": ("pt", "pt_BR"),
    "AR": ("es", "es_AR"),
}


def parse_locale_tag(raw: str | None) -> tuple[str, str] | None:
    """Parse `en_US.UTF-8` / `en-US` / `LANG=en_US.UTF-8` into (language, locale)."""
    if not raw:
        return None
    tag = raw.strip().strip('"').strip("'")
    # localectl / some locale tools print "LANG=en_US.UTF-8"
    if "=" in tag:
        tag = tag.rsplit("=", 1)[-1].strip()
    tag = tag.split(".", 1)[0].replace("-", "_")
    if not tag or tag.upper() in {"C", "POSIX"}:
        return None
    parts = tag.split("_", 1)
    language = parts[0].lower()
    if len(language) < 2 or not language.isalpha():
        return None
    if len(parts) == 1:
        language_defaults = {"en": "en_US", "de": "de_DE", "fr": "fr_FR", "es": "es_ES"}
        return language, language_defaults.get(language, f"{language}_{language.upper()}")
    region = parts[1].upper()
    if len(region) >= 2 and region[:2].isalpha():
        return language, f"{language}_{region[:2]}"
    return None


def detect_homelab_locale(tz_name: str = "UTC", region: str | None = None) -> tuple[str, str]:
    """Detect (language, locale) from host env, else map from phone region / TZ."""
    for key in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        raw = os.environ.get(key)
        if key == "LANGUAGE" and raw:
            raw = raw.split(":", 1)[0]
        parsed = parse_locale_tag(raw)
        if parsed:
            return parsed

    for cmd in (
        "localectl status 2>/dev/null | awk -F: '/System Locale/{print $2; exit}'",
        "locale 2>/dev/null | awk -F= '/^LANG=/{print $2; exit}'",
    ):
        try:
            out = (run_cmd(cmd, check=False) or "").strip().strip('"').strip("'")
            parsed = parse_locale_tag(out)
            if parsed:
                return parsed
        except Exception:
            pass

    resolved_region = (region or phone_region_from_tz(tz_name)).upper()
    return _LOCALE_BY_REGION.get(resolved_region, ("en", "en_US"))
