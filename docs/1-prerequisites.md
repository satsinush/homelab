## 📋 Prerequisites

This project is meant for Arch Linux systems using the `pacman` package manager.
Services will run on other operating systems with different package managers, but the installation instructions will be different and the Homelab Dashboard Host API will not function properly.
Before you begin, ensure your device is up to date and that the following packages are installed on your Arch Linux host:

```shell
# Install core dependencies
sudo pacman -Syu
sudo pacman -S apache docker jq lm_sensors arp-scan wireguard-tools nodejs npm git docker-compose docker-buildx argon2 restic --needed
```

  * After installing `lm_sensors`, run `sudo sensors-detect` to initialize sensor data for Netdata to use.
  * The `apache` package is needed for the `htpasswd` utility used by the setup script to create secure password hashes.

## Next: 2\. ⚙️ Configure and Harden Host
[Continue to the next section of the guide for detailed instructions on configuring and hardening your host machine.](./2-host-config.md)