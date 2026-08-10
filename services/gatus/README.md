# 📈 Gatus Service Health Monitoring

Gatus is a developer-oriented health dashboard that monitors endpoints and services.

* **Official Documentation:** [gatus.io](https://gatus.io/)

---

## Overview

Gatus performs active HTTP/HTTPS and TCP health checks against all internal homelab services and external connectivity.

## Architecture & Configuration

* **Container Name:** `gatus` (`status.<your-hostname>`)
* **Config File:** Configured in `services/gatus/config.yaml`.
* **Database:** Embedded SQLite database for storing uptime history metrics.

## Features

* **Status Page:** `https://status.<your-hostname>` (Public, read-only status dashboard)
* **Alert Integration:** Outbound alerts are routed to the internal alerts gateway (`http://alerts/gatus`), delivering real-time push notifications via Gotify.

## Verification

```bash
# Check Gatus status
docker compose ps gatus

# View health check logs
docker compose logs gatus --tail 50
```
