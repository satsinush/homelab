# 🖥️ RustDesk Remote Desktop

RustDesk provides self-hosted remote desktop control infrastructure.

* **Official Documentation:** [rustdesk.com/docs](https://rustdesk.com/docs/)

---

## Overview

RustDesk consists of an ID server (`hbbs`) and a Relay server (`hbbr`). It allows secure peer-to-peer or relay-assisted remote desktop sessions without third-party cloud servers.

## Architecture & Containers

* **Containers:**
  * `rustdesk-id-server`: `hbbs` signal and registration server
  * `rustdesk-relay-server`: `hbbr` data relay fallback server
* **Public Key:** Encrypted key saved at `volumes/secrets/rustdesk_public_key`

## Ports & Configuration

| Port | Protocol | Purpose |
| --- | --- | --- |
| `21115` | TCP | NAT type test |
| `21116` | TCP/UDP | ID server signal & TCP hole punching |
| `21117` | TCP | Relay server |
| `21118` / `21119` | TCP | Web client WebSocket (if enabled) |

## Verification

```bash
# Check containers
docker compose ps rustdesk-id-server rustdesk-relay-server

# View public key for client setup
cat volumes/secrets/rustdesk_public_key
```
