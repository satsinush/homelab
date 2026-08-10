## 💻 Host Machine Configuration

Before deploying the Docker stack, the host needs hardened SSH, a firewall, VPN host prep, and DNS configuration. All of it is applied by the **[Ansible playbook](../ansible/README.md)** — this page covers the one-time bootstrap, what the playbook manages, and the few steps that stay manual (router settings, client enrollment).

### 1\. 🔑 Bootstrap SSH access (before Ansible)

Ansible connects over SSH, so key-based login must work first.

1. **On the server**, install and start the SSH service if you haven't already:

```shell
sudo pacman -S openssh
sudo systemctl enable --now sshd
```

2. **On your local machine**, generate a key (if needed) and copy it over:

```shell
ssh-keygen -t ed25519 -C "your_email@example.com"
ssh-copy-id user@server_ip
ssh user@server_ip   # confirm key login works
```

* **Docs:** [OpenSSH Wiki 🔗](https://wiki.archlinux.org/title/OpenSSH)

### 2\. 🅰️ Run the Ansible playbook

Follow [`ansible/README.md`](../ansible/README.md): copy `inventory.example.yml` to the gitignored `inventory.yml`, fill in your host's address, user, interfaces, and subnets, then:

```shell
ansible-playbook site.yml --check --diff -K   # dry run; -K asks for your sudo password
ansible-playbook site.yml -K
```

What it configures (source of truth is the role files under [`ansible/roles/`](../ansible/roles/)):

| Area | What's applied |
| --- | --- |
| **SSH hardening** | Port `2222`, key-only auth, no root login — via drop-in `/etc/ssh/sshd_config.d/10-homelab.conf` |
| **firewalld zones** | `local` (LAN), `vpn` (Tailscale `tailscale0`, Headscale prefix), `docker` (bridge subnet) — each opens only the services that zone needs (SSH, HTTP/S, DNS, RustDesk, SMB, IMAPS/SMTPS) |
| **Forwarding policies** | `vpn-to-lan`, `lan-to-vpn`, `docker-to-any` + masquerading, so VPN ↔ LAN routing works both directions |
| **VPN host prep** | `net.ipv4.ip_forward=1`, TUN module, disables legacy `wg-quick@wg0` (Headscale itself runs in Docker) |
| **Host DNS** | Installs the [`dns/`](../dns/) configs — disables the systemd-resolved stub listener so Pi-hole can own port 53 |
| **Docker** | Daemon enabled, your user added to the `docker` group |

> **⚠️ Lockout warning:** the firewall role opens `2222/tcp` before sshd is moved off port 22, but keep your current SSH session open until you've verified `ssh -p 2222 user@server_ip` works. Afterwards update `ansible_port` in `inventory.yml`.

To verify the firewall after a run:

```shell
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=vpn --list-all
```

### 3\. 🛰️ Headscale VPN (Tailscale control plane)

Headscale is the self-hosted Tailscale **control server**, published at `https://<HEADSCALE_WEB_HOSTNAME>` (default `vpn.<your-hostname>`). That hostname must resolve to **this** machine for clients and for `headscale-router`. In production use a **publicly resolvable** name (public A/AAAA + port-forwards here); a LAN-only name is fine for lab/dev if DNS points at this host. Do not use a bare IP or a public name aimed at a different server. Clients use the official Tailscale app and sign in via **Authentik OIDC**. A `headscale-router` container advertises your LAN subnet so remote devices can reach home services, and an **embedded DERP relay** replaces Tailscale's public relays entirely. The containers, config, and OIDC secrets are all handled by `python3 setup.py setup` — nothing to install on the host beyond what Ansible already did.

**After the stack is up:**

1. Open `https://vpn.<your-hostname>` — enrollment uses Authentik.
2. On phones/laptops, install Tailscale and set the login / control server to that same URL.
3. Sign in with your Authentik account (`homelab-users` / `homelab-admins`).
4. Confirm LAN reachability (e.g. ping `10.10.10.10` or open `https://dashboard.<hostname>`).

#### Split-horizon DNS (keep everything else off the internet)

The whole point of the VPN is that services are **not** reachable from the internet — only the Headscale endpoint is. This is enforced at three layers:

* **Public DNS (Cloudflare):** create a **single** `A` record `vpn.<your-hostname>` pointing at your public IP, kept current by `ddclient`. Set it **DNS-only (grey cloud)** — the Cloudflare proxy would break Tailscale's WebSocket/DERP/STUN traffic. Do **not** publish any other `*.<your-hostname>` record. Point `ddclient` at this record (edit `ddclient/volumes/ddclient.conf`).
* **Internal DNS (Pi-hole/Unbound):** `*.<your-hostname>` resolves to the server's LAN IP (`10.10.10.10`), so on the LAN/VPN every service works normally.
* **Traefik:** only the Headscale router is bound to the public entrypoint (`websecure-public`, port `8443`). Every other service stays on `websecure` (443). Even if someone sends `dashboard.<your-hostname>` as a Host header straight to your public IP, Traefik answers `404`.

#### Home router configuration (manual)

* **DHCP reservation** for the server so its LAN IP never changes.
* **Static route**: destination `HEADSCALE_IPV4_PREFIX` (default `100.64.0.0/24`) via the server's LAN IP. The subnet router runs with SNAT disabled, so this return route is required for VPN ↔ LAN traffic in both directions.
* **Port forwards** to the server's LAN IP (these are the *only* ports the internet can reach):

  | WAN port | → Host port | Purpose |
  | --- | --- | --- |
  | `443/tcp` | `8443/tcp` | Headscale control + DERP-over-HTTPS (Traefik public entrypoint) |
  | `3478/udp` | `3478/udp` | Embedded DERP STUN (NAT traversal / relay fallback) |
  | `41641/udp` | `41641/udp` | Pinned WireGuard data plane → direct peer connections |

  With `41641/udp` forwarded the home node has a stable endpoint, so remote-client → LAN traffic is almost always **direct** (no relay). The embedded DERP only handles rendezvous and the rare case where a direct path can't be built. There is **no** dependency on Tailscale's public relays and **no** Cloudflare Tunnel.

* **Docs:** [Headscale](https://headscale.net/) · [Authentik integration](https://integrations.goauthentik.io/networking/headscale/)

### 4\. Additional Shell Configurations (Optional)

Follow these steps to add additional functionality to your shell.

1.  **.bashrc**: From the repo root on the server, run:

    ```bash
    ./bashrc/apply.bashrc.sh
    ```

    That installs [`user.bashrc`](../bashrc/user.bashrc) → `~/.bashrc` and [`root.bashrc`](../bashrc/root.bashrc) → `/root/.bashrc` (with timestamped `.bak.*` copies of any existing files), and ensures `.bash_profile` sources `.bashrc`. Then `source ~/.bashrc` (or open a new SSH session).

## Next: 3\. 🚀 Deploy the Services
[Continue to the next section of the guide for detailed instructions on deploying the homelab services.](./3-deployment.md)
