# Add the following to your ~/.bashrc

# -- Prompt --
# Set a color prompt with different colors for root and normal users
if [ "$(id -u)" -eq 0 ]; then
  # This is the root user: Red prompt
  export PS1="\[\e[1;31m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]"'# '
else
  # This is a normal user: Green prompt
  export PS1="\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ "
fi

# -- Enable Colors --
# Check for a color-capable terminal and set LS_COLORS
if [ -x /usr/bin/dircolors ]; then
    eval "$(dircolors -b)"
fi

# -- Aliases --
# Add some useful shortcuts
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'

# --- Custom Welcome Message for SSH (Minimal Color) ---

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
