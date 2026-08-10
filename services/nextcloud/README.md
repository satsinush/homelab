# ☁️ Nextcloud (Files, Calendar, Contacts, Office)

Nextcloud handles file storage, WebDAV/CalDAV/CardDAV sync, and collaborative document editing.

* **Official Documentation:** [docs.nextcloud.com](https://docs.nextcloud.com/)

---

## Overview

Nextcloud integrates with Authentik for OIDC authentication. Storage is bound to host filesystem paths, and document editing is powered by an integrated Collabora Online server.

## Architecture & Services

* **Containers:**
  * `nextcloud`: Core PHP-FPM / web application server (`cloud.<your-hostname>`)
  * `nextcloud-cron`: Scheduled background task worker (runs every 5 minutes)
  * `nextcloud-postgres`: Dedicated PostgreSQL database container
  * `nextcloud-redis`: Session and file-locking memory cache
  * `collabora`: Collabora Online WOPI office engine (`office.<your-hostname>`)
* **Storage Paths:** User files live on the host under `storage/users/<username>/files/` and shared data lives under `storage/shared/`.

## Features & Integration

* **URL:** `https://cloud.<your-hostname>`
* **Collabora Office:** `https://office.<your-hostname>` (WOPI backend for inline `.odt`, `.ods`, `.docx` editing)
* **DAV Endpoints:**
  * CalDAV / CardDAV: `https://cloud.<your-hostname>/remote.php/dav`
  * WebDAV: `https://cloud.<your-hostname>/remote.php/dav/files/<username>/`
* **Mail Client:** Nextcloud Mail connects locally to Stalwart (`mail.<your-hostname>`).

## Maintenance & Diagnostics

```bash
# Check Nextcloud container health
docker compose ps nextcloud nextcloud-cron collabora

# Run OCC commands
docker exec -u www-data -it nextcloud php occ status
docker exec -u www-data -it nextcloud php occ config:system:get maintenance_window_start

# Break-glass local admin login URL
# https://cloud.<your-hostname>/login?direct=1 (password in volumes/secrets/nextcloud_admin_password)
```
