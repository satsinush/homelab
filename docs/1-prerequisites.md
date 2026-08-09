## 📋 Prerequisites & Workstation Setup

This project targets Arch Linux hosts and requires **Ansible** run from a control workstation (laptop/desktop) to automate all host-level configuration (packages, firewall, SSH hardening, Docker, host DNS, and VPN prep).

Manual host package configuration is not supported — Ansible is the single source of truth for host setup.

---

### 1. 💻 Control Workstation Setup

On your workstation (where you run Ansible), install Ansible core and the required Galaxy collections:

```shell
# Install Ansible core & galaxy requirements
pipx install ansible-core        # or: sudo pacman -S ansible
ansible-galaxy collection install -r ansible/requirements.yml
```

---

### 2. 🖥️ Target Host Prerequisites (Arch Linux)

On the target host, ensure:
- Arch Linux is installed and accessible over SSH.
- Your SSH key is copied to the host (`ssh-copy-id user@server_ip`).
- Your remote user has `sudo` privileges.

The Ansible `packages` role will handle installing all host dependencies automatically:

* `docker`, `docker-compose`, `docker-buildx`
* `apache` (for `htpasswd` password hashing utility)
* `restic` (encrypted offsite cloud backups)
* `acl` (POSIX ACLs for container file permissions)
* `lm_sensors`, `arp-scan` (hardware sensors & LAN device scanning)
* `nodejs`, `npm`, `git`, `jq`, `argon2`, `python`, `openssh`, `firewalld`

---

## Next: 2\. ⚙️ Configure and Harden Host
[Continue to the next section of the guide for detailed instructions on configuring your inventory and running the Ansible playbook.](./2-host-config.md)