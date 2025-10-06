# Add the following to /root/.bashrc

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