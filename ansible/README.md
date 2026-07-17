# 🅰️ Ansible Host Provisioning

Automates docs [1-prerequisites](../docs/1-prerequisites.md) and [2-host-config](../docs/2-host-config.md) for an Arch Linux host (e.g. the Pi):
packages, firewalld zones/policies, SSH hardening, Docker, VPN host prep (for Headscale/Tailscale), host DNS, and `docker compose up`.

**Division of labor:** Ansible owns the *host*; [`setup.py`](../setup.py) still owns the *apps*
(`.env` generation, secrets, Authentik blueprints, Headscale OIDC, Gotify apps, SFTPGo users, systemd units, backups).
Run Ansible first, then `python3 setup.py setup` once on the host.

## Setup (from your workstation)

```shell
# 1. Install ansible + the pacman module collection
pipx install ansible-core        # or: sudo pacman -S ansible
ansible-galaxy collection install -r requirements.yml

# 2. Describe this host (gitignored)
cp inventory.example.yml inventory.yml
# Edit SSH user/address plus LAN, VPN (tailscale0), and Docker interfaces/subnets.

# 3. Dry run, then apply
# -K prompts for your sudo (become) password on the host
ansible-playbook site.yml --check --diff -K
ansible-playbook site.yml -K
```

The example starts on SSH port 22. After the first run, change `ansible_port` in
`inventory.yml` to the configured `ssh_port` (2222 by default).
The firewall role opens `2222/tcp` *before* the ssh role moves sshd, so you won't be locked out —
but keep your current session open until you've verified `ssh -p 2222 <host>` works.

## What each role does

| Role | Manages |
| --- | --- |
| `packages` | pacman packages (docker, restic, acl, …) — see [prerequisites](../docs/1-prerequisites.md) |
| `firewalld` | zones `local`/`vpn`/`docker`, services `ssh-custom`/`rustdesk`/`samba-homelab`, forwarding policies |
| `ssh` | key-only auth + custom port via `/etc/ssh/sshd_config.d/10-homelab.conf` |
| `docker` | daemon enabled, user in `docker` group |
| `vpn` | ip_forward + TUN; disables legacy `wg-quick@wg0` (Headscale runs in Docker) |
| `dns` | copies [`dns/`](../dns/) files → `/etc/` (frees port 53 for Pi-hole) |
| `deploy` | optional git clone + `docker compose up -d` (skipped until `.env` exists) — see [deployment](../docs/3-deployment.md) |

These roles **are** the reference for host configuration — [docs/2-host-config.md](../docs/2-host-config.md) only covers the SSH bootstrap, running this playbook, and the manual router/client steps.

Host-specific values live in the gitignored `inventory.yml`: SSH address/user,
interfaces, and subnets. Ansible derives `homelab_user` from `ansible_user` and
`homelab_dir` from that remote account's passwd entry.

Reusable policy/defaults live in
[`group_vars/homelab.yml`](group_vars/homelab.yml): service ports, feature toggles,
and optional repository settings.

## Still manual (by design)

- Router: DHCP reservation, a static route for `HEADSCALE_IPV4_PREFIX`
  (default `100.64.0.0/24`) via the homelab server, and three port forwards —
  `443/tcp → 8443/tcp` (Headscale/DERP), `3478/udp` and `41641/udp`. The
  firewalld role opens these on the `local` zone; split-horizon DNS keeps every
  other service off the internet. See [docs/2-host-config.md](../docs/2-host-config.md#3--headscale-vpn-tailscale-control-plane)
- `sensors-detect` (interactive), `ssh-copy-id` of your key
- `python3 setup.py setup` on the host — interactive first run (users, SSL mode, Cloudflare tokens)
- Client devices: install the Tailscale app and set the Headscale control URL (see [checklist](../docs/4-checklist.md))
