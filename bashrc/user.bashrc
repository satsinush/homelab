#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

# --- History Control ---
# Don't put duplicate lines or lines starting with space in the history.
HISTCONTROL=ignoreboth

# Append to the history file, don't overwrite it
shopt -s histappend

# Increase history size (School settings)
HISTSIZE=1000
HISTFILESIZE=2000

# --- Shell Options ---
# Check the window size after each command (fixes issues when resizing terminals)
shopt -s checkwinsize

# Enable "**" for recursive globbing (e.g., ls **/*.py)
shopt -s globstar

# Make less more friendly for non-text input files, see lesspipe(1)
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# --- Environment Variables ---
# Add local bin to path
export PATH="$HOME/utils/bin:/usr/local/bin:$PATH"

# Colored GCC warnings and errors (Useful for C++ dev)
export GCC_COLORS='error=01;31:warning=01;35:note=01;36:caret=01;32:locus=01:quote=01'

# Colored Man Pages
export MANPAGER="less -R --use-color -Dd+r -Du+b"

# --- Prompt Settings ---
# Set a color prompt with different colors for root and normal users
if [ "$(id -u)" -eq 0 ]; then
    # Root user: Red prompt
    export PS1="\[\e[1;31m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]"'# '
else
    # Normal user: Green prompt
    export PS1="\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ "
fi

# --- Aliases ---
# Enable colors for ls and grep
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# Navigation shortcuts
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# Arch Linux specific shortcuts
alias update='sudo pacman -Syu'

# Docker Shortcuts
alias dps='docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"' # Prettier output
alias dlog='docker logs -f'      # Follow logs: dlog <container_name>
alias dstop='docker stop'
alias dstart='docker start'
alias dcomp='docker compose'     # Quick access to compose

# Networking
alias ports='sudo ss -tulanp'    # Show all open ports and what process is using them
alias myip='curl ifconfig.me'    # Get your external public IP quickly

# Ask for confirmation before overwriting/deleting more than 3 files
alias cp='cp -I'
alias mv='mv -I'
alias rm='rm -I'

# Make directory and enter it immediately
mkcd () {
  mkdir -p "$1"
  cd "$1"
}

# Import separate aliases file if it exists
if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# --- Bash Completion ---
# Enables tab completion for parameters (essential for systemd, docker, pacman, etc.)
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# --- Custom Welcome Message for SSH ---

# Define ANSI Color Codes
RED='\033[0;31m'
NC='\033[0m' # No Color (resets the text)

# Check if the shell is interactive and an SSH connection is active
if shopt -q login_shell && [[ -n "$SSH_CONNECTION" ]]; then

    # Determine Color and Message for Updates
    UPDATES=$(pacman -Qu 2> /dev/null | wc -l)
    UPDATE_COLOR="$NC"
    UPDATE_MESSAGE="(System is synced)"

    if [ "$UPDATES" -gt 0 ]; then
        UPDATE_COLOR="$RED"
        UPDATE_MESSAGE="(${RED}Run 'sudo pacman -Syu')${NC}"
    fi

    # Get IP address using the 'ip' command
    LOCAL_IP=$(ip a s | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n 1)

    echo
    echo "   _   _  ___  __  __ _____ _        _    ____    "
    echo "  | | | |/ _ \|  \/  | ____| |      / \  | __ )   "
    echo "  | |_| | | | | |\/| |  _| | |     / _ \ |  _ \   "
    echo "  |  _  | |_| | |  | | |___| |___ / ___ \| |_) |  "
    echo "  |_| |_|\___/|_|  |_|_____|_____/_/   \_\____/   "
    echo
    echo "--------------------------------------------------"
    echo
    echo "  Hostname: $(hostname)"
    echo "  Local IP: $LOCAL_IP"
    echo "  Uptime:   $(uptime -p)"
    echo -e "  Updates Available: $UPDATES $UPDATE_COLOR$UPDATE_MESSAGE$NC"
    echo
    echo "--------------------------------------------------"
    echo
fi