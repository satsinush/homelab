## 📋 Prerequisites

This project is meant for Arch Linux systems using the `pacman` package manager.
Services will run on other operating systems with different package managers, but the installation instructions will be different and the Homelab Dashboard Host API will not function properly.
Before you begin, ensure your device is up to date and that the following packages are installed on your Arch Linux host:

```shell
# Install core dependencies
sudo pacman -Syu
sudo pacman -S \
  openssl \         # Core SSL/TLS toolkit
  apache \          # For the 'htpasswd' utility
  sed grep xargs \  # Text manipulation utilities
  docker jq \       # Docker and JSON processor
  lm_sensors \      # For initializing hardware sensors
  arp-scan \        # For LAN device scanning
  openssh \         # Secure Shell server
  wireguard-tools \ # WireGuard VPN tools
  ufw               # Uncomplicated Firewall
```

  * After installing `lm_sensors`, run `sudo sensors-detect` to initialize sensor data for Netdata to use.
  * The `apache` package is needed for the `htpasswd` utility used by the setup script to create secure password hashes.