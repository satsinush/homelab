# 🔔 Gotify Push Notification Server

Gotify is a self-hosted server for sending and receiving push notifications.

* **Official Documentation:** [gotify.net/docs](https://gotify.net/docs/)

---

## Overview

Gotify acts as the central notification hub for the homelab. It receives alerts from Gatus, Vaultwarden, Dockhand, Stalwart, and the Homelab Dashboard Host API.

## Architecture & Storage

* **Container Name:** `gotify` (`notify.<your-hostname>`)
* **Database:** SQLite database stored at `services/gotify/volumes/data/gotify.db` (online `.backup` executed during Restic snapshots).

## Configuration & Access

* **URL:** `https://notify.<your-hostname>`
* **Alerts User:** `alerts` (password in `volumes/secrets/gotify_alerts_password`) - intended for installation on mobile devices and desktop notification clients.
* **Break-glass Admin:** `admin` (password in `volumes/secrets/gotify_admin_password`).
* **Application Tokens:** Generated per emitting service (Gatus, Dashboard, Vaultwarden, Mail, Dockhand).

## Verification

```bash
# Check Gotify container status
docker compose ps gotify

# View logs
docker compose logs gotify --tail 50
```
