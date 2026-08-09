# 🏠 Homelab Dashboard & Host API

The Homelab Dashboard is the central web user interface and host API control node for the environment.

---

## Overview

The dashboard provides a modern web interface for managing host packages, scanning LAN devices (with Wake-on-LAN), solving word games, interacting with the local Ollama AI chatbot, and monitoring secrets/system health.

## Architecture & Integration

* **Containers & Services:**
  * `dashboard`: Frontend web app and express backend container (`dashboard.<your-hostname>`)
  * `homelab-host-api.service`: Systemd service on Arch Linux host running `services/dashboard/host-api/server.ts` (listening on localhost port `3001`)
* **Word Games:** Executes compiled C++ binary (`p++` from `puzzle-plus-plus`) inside the container backend.

## Features

* **URL:** `https://dashboard.<your-hostname>`
* **Host API Service:** Systemd service `homelab-host-api.service` running on the host at port `3001`.
* **Package Updates:** Checks Arch Linux `pacman` updates automatically.

## Verification

```bash
# Check container status
docker compose ps dashboard

# Check systemd host API service
systemctl status homelab-host-api.service

# View host API logs
journalctl -u homelab-host-api.service --tail 50
```
