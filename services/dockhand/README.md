# 📦 Dockhand Container Management UI

Dockhand is a web-based Docker compose container management interface.

* **Official Documentation:** [github.com/dockhand-dev/dockhand](https://github.com/dockhand-dev/dockhand)

---

## Overview

Dockhand visualizes Docker stacks, container status, resource usage, and container logs directly in the browser.

## Architecture & Permissions

* **Container Name:** `dockhand` (`docker.<your-hostname>`)
* **Docker Socket:** `/var/run/docker.sock` (mounted read-only)

## Configuration & SSO

* **URL:** `https://docker.<your-hostname>`
* **Authentik SSO:** Restricted exclusively to members of the **`homelab-admins`** group.
* **Break-glass Admin:** User `admin` (password in `volumes/secrets/dockhand_admin_password`).

## Verification

```bash
# Check container status
docker compose ps dockhand

# View logs
docker compose logs dockhand --tail 50
```
