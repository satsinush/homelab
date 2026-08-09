# 🌐 ddclient Dynamic DNS

ddclient updates Dynamic DNS (DDNS) record entries to ensure external domains reflect changing home WAN IP addresses.

* **Official Documentation:** [ddclient.net](https://ddclient.net/)

---

## Overview

ddclient runs as a background service that periodically queries WAN IP providers and updates Cloudflare (or other configured DNS provider) A records.

## Architecture & Configuration

* **Container Name:** `ddclient`
* **Config File:** `services/ddclient/volumes/ddclient.conf`
* **Seeded From:** `services/ddclient/example.ddclient.conf`

## Verification

```bash
# Check ddclient status
docker compose ps ddclient

# Force DDNS update & check logs
docker compose logs ddclient --tail 50
```
