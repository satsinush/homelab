# 🔔 Alerts Relay Gateway

The Alerts service provides internal HTTP routing and SMTP gateway functionality for system notification delivery across the homelab stack.

---

## Overview

The Alerts gateway (`http://alerts`) receives HTTP webhooks and SMTP messages from internal services (such as Vaultwarden password resets, Gatus status updates, or Stalwart mail webhooks) and relays them to Gotify applications via Apprise or direct Gotify REST API.

## Architecture

* **Container Name:** `alerts` (listening on port `80` inside `homelab-net`)
* **SMTP Gateway:** Listens on port `25` inside `homelab-net` for email notifications (e.g. Vaultwarden) and routes them to Gotify.

---

## Webhook URL Structure & Parameters

### Endpoint URLs

Internal containers send POST requests to the gateway using any of the following URL structures:

* **Tag in Path (Recommended):** `http://alerts/<tag>` or `http://alerts/alerts/<tag>`
* **Tag in Query Parameter:** `http://alerts/?service=<tag>`
* **Generic Fallback:** `http://alerts/` (routes to `general` tag if unassigned)

### Valid Tags (`<tag>`)

Supported tags route notifications to matching Gotify applications:
- `gatus`: Gatus health monitoring alerts
- `dashboard`: Dashboard package update alerts
- `vaultwarden`: Password reset and security emails
- `dockhand`: Docker container management alerts
- `mail`: Stalwart incoming email notifications
- `general`: System and catch-all notifications

---

### Request Payload Format

The gateway accepts `application/json`, `application/x-www-form-urlencoded`, or `message/rfc822` (raw email).

#### JSON Fields

| Field Name | Type | Description | Example / Default |
| --- | --- | --- | --- |
| `title` / `subject` | String | Title of the notification | `"Gatus: Web Service Triggered"` |
| `message` / `msg` / `text` | String | Notification body text | `"HTTP 500 Bad Gateway"` |
| `service` | String | Optional tag override | `"vaultwarden"` |
| `priority` | Integer | Notification priority (1–10) | `5` |
| `click_url` / `clickUrl` / `url` | String | Optional URL opened when tapped in Gotify app | `"https://status.homelab.home.arpa"` |

#### Example CURL Call

```bash
curl -X POST http://alerts/gatus \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Gatus Alert Triggered",
    "message": "Vaultwarden endpoint returned 502 Bad Gateway",
    "priority": 8,
    "click_url": "https://status.homelab.home.arpa"
  }'
```

---

## Verification

```bash
# Check alerts service status
docker compose ps alerts

# View relay logs
docker compose logs alerts --tail 50
```
