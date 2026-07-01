"""Shared utilities for homelab setup scripts."""
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
