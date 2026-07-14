"""Shared utilities for homelab setup scripts."""
from __future__ import annotations

import os
import subprocess
import secrets
import json
import time


def run_cmd(cmd, cwd=None, shell=True, check=True):
    """Run a shell command safely and return stripped stdout."""
    try:
        res = subprocess.run(cmd, cwd=cwd, shell=shell, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {cmd}\nOutput: {e.stdout}\nError: {e.stderr}")
        if check:
            import sys
            sys.exit(1)
        return None


def gen_secret(name, length_bytes):
    """Generate a hex secret file in ./volumes/secrets/ if it doesn't already exist."""
    os.makedirs("./volumes/secrets", exist_ok=True)
    try:
        os.chmod("./volumes/secrets", 0o700)
    except OSError:
        pass
    path = f"./volumes/secrets/{name}"
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        val = secrets.token_hex(length_bytes)
        with open(path, "w") as f:
            f.write(val + "\n")
        print(f"     Generated {name}")
        os.chmod(path, 0o600)


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
            print(f"   ⚠️  network_curl failed: {stderr.strip()}")
        return "", 0
    status_code = int(lines[-1])
    body = "\n".join(lines[:-1])
    return body, status_code


def wait_for_containers(timeout=120):
    """Wait for all Docker Compose containers to be running and healthy."""
    print("   Waiting for all containers to be running and healthy...")
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
            state = c.get("State", "").lower()
            health = c.get("Health", "").lower()

            if state in ["exited", "stopped"] and name == "setup":
                continue

            if state != "running":
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({state})")
                continue

            if health and health not in ["healthy", "none"]:
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({health})")

        if all_ok:
            print("   All containers are running and healthy! 🎉")
            return True

        elapsed = int(time.time() - start_time)
        print(f"   [{elapsed}s] Still waiting for: {', '.join(starting_or_unhealthy[:4])}... \033[K", end="\r")
        time.sleep(2)

    print("\n   ⚠️  Timeout reached. Proceeding with configuration anyway...")
    return False


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
