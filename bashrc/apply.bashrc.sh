#!/usr/bin/env bash
# Install repo bashrc templates onto this host (user + root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_SRC="$ROOT/user.bashrc"
ROOT_SRC="$ROOT/root.bashrc"

if [[ ! -f "$USER_SRC" || ! -f "$ROOT_SRC" ]]; then
  echo "error: missing $USER_SRC or $ROOT_SRC" >&2
  exit 1
fi

# Target login user for ~/.bashrc (not root when invoked via sudo).
if [[ "$(id -u)" -eq 0 ]]; then
  TARGET_USER="${SUDO_USER:-${HOMELAB_USERNAME:-}}"
  if [[ -z "$TARGET_USER" || "$TARGET_USER" == root ]]; then
    echo "error: run as your login user (./bashrc/apply.bashrc.sh), or set HOMELAB_USERNAME" >&2
    exit 1
  fi
else
  TARGET_USER="$(id -un)"
fi

TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if [[ -z "$TARGET_HOME" || ! -d "$TARGET_HOME" ]]; then
  echo "error: could not resolve home for $TARGET_USER" >&2
  exit 1
fi

USER_DST="$TARGET_HOME/.bashrc"
ROOT_DST="/root/.bashrc"
stamp="$(date +%Y%m%d%H%M%S)"

backup() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cp -a "$path" "${path}.bak.${stamp}"
    echo "backed up $path → ${path}.bak.${stamp}"
  fi
}

install_user() {
  backup "$USER_DST"
  if [[ "$(id -u)" -eq 0 ]]; then
    install -o "$TARGET_USER" -g "$(id -gn "$TARGET_USER")" -m 644 "$USER_SRC" "$USER_DST"
  else
    install -m 644 "$USER_SRC" "$USER_DST"
  fi
  echo "installed $USER_SRC → $USER_DST"
}

install_root() {
  backup "$ROOT_DST"
  if [[ "$(id -u)" -eq 0 ]]; then
    install -o root -g root -m 644 "$ROOT_SRC" "$ROOT_DST"
  else
    sudo install -o root -g root -m 644 "$ROOT_SRC" "$ROOT_DST"
  fi
  echo "installed $ROOT_SRC → $ROOT_DST"
}

ensure_bash_profile() {
  local home="$1" user="$2" profile="$1/.bash_profile"
  local snippet=$'#\n# ~/.bash_profile\n#\n\n[[ -f ~/.bashrc ]] && . ~/.bashrc\n'
  if [[ -f "$profile" ]] && grep -q '\.bashrc' "$profile"; then
    echo "ok $profile already sources .bashrc"
    return
  fi
  if [[ -f "$profile" ]]; then
    backup "$profile"
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    printf '%s' "$snippet" >"$profile"
    chown "$user:$(id -gn "$user")" "$profile"
    chmod 644 "$profile"
  elif [[ "$home" == "$HOME" ]]; then
    printf '%s' "$snippet" >"$profile"
    chmod 644 "$profile"
  else
    sudo tee "$profile" >/dev/null <<<"$snippet"
    sudo chown "$user:$(id -gn "$user")" "$profile"
    sudo chmod 644 "$profile"
  fi
  echo "wrote $profile (sources .bashrc)"
}

install_user
if [[ "$(id -u)" -eq 0 ]]; then
  install_root
  ensure_bash_profile "$TARGET_HOME" "$TARGET_USER"
  ensure_bash_profile /root root
else
  install_root
  ensure_bash_profile "$TARGET_HOME" "$TARGET_USER"
  if [[ ! -f /root/.bash_profile ]] || ! sudo grep -q '\.bashrc' /root/.bash_profile 2>/dev/null; then
    stamp_root="$stamp"
    if sudo test -f /root/.bash_profile; then
      sudo cp -a /root/.bash_profile "/root/.bash_profile.bak.${stamp_root}"
      echo "backed up /root/.bash_profile → /root/.bash_profile.bak.${stamp_root}"
    fi
    printf '%s\n' '#' '# ~/.bash_profile' '#' '' '[[ -f ~/.bashrc ]] && . ~/.bashrc' | sudo tee /root/.bash_profile >/dev/null
    sudo chmod 644 /root/.bash_profile
    echo "wrote /root/.bash_profile (sources .bashrc)"
  else
    echo "ok /root/.bash_profile already sources .bashrc"
  fi
fi

echo
echo "Done. Reload your shell:  source ~/.bashrc"
echo "New SSH sessions pick this up automatically."
