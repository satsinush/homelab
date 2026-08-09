# 🛰️ Headscale VPN (Tailscale Control Plane)

Headscale is a self-hosted implementation of the Tailscale control server.

* **Official Documentation:** [headscale.net](https://headscale.net/)

---

## Overview

Headscale manages network keys, WireGuard node registration, and DERP relay paths for remote clients running official Tailscale apps. User enrollment uses Authentik OIDC authentication.

## Architecture & Services

* **Containers:**
  * `headscale`: Core Tailscale control server
  * `headscale-router`: Tailscale client container acting as LAN subnet router (`LAN_SUBNET`)
* **Configuration:** Configured dynamically via `services/headscale/config.yaml.template` generated during `setup.py`.
* **State Persistence:** SQLite DB stored in `services/headscale/volumes/var/lib/headscale/db.sqlite`.

## Key Features

* **Subnet Router (`headscale-router`):** Advertises your local network (`LAN_SUBNET`) and routes VPN traffic to home services without NAT.
* **Embedded DERP Relay:** Embedded STUN server on port `3478/udp` and HTTPS relay over Traefik (`8443`) replace public Tailscale relays completely.
* **OIDC Enrollment:** Mobile and desktop Tailscale clients log in via Authentik SSO at `https://vpn.<your-hostname>`.

## Ports & Firewall Rules

| Port | Protocol | Purpose |
| --- | --- | --- |
| `443` (WAN) → `8443` (Host) | TCP | Headscale control plane & DERP-over-HTTPS |
| `3478` | UDP | Embedded DERP STUN (NAT traversal) |
| `41641` | UDP | WireGuard direct peer traffic |

## Common Administrative Commands

```bash
# List all registered tailnet nodes
docker exec -it headscale headscale nodes list

# Disable key expiration for personal devices (prevents unexpected logouts)
docker exec -it headscale headscale nodes expire --identifier <NODE_ID> --disable

# Register node via pre-authenticated key (if OIDC is bypassed)
docker exec -it headscale headscale preauthkeys create -e 24h
```
