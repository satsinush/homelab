# 📷 Immich Photo & Video Backup

Immich is a high-performance self-hosted photo and video backup solution.

* **Official Documentation:** [immich.app/docs](https://immich.app/docs/)

---

## Overview

Immich acts as the dedicated photo management application for the homelab, separate from Nextcloud. It features automatic mobile backup, facial recognition, smart search, and Authentik OIDC integration.

## Architecture & Containers

* **Containers:**
  * `immich-server`: Web application and REST API endpoint (`photos.<your-hostname>`)
  * `immich-machine-learning`: Python-based ML worker for smart search, face detection, and CLIP image classification
  * `immich-postgres`: PostgreSQL database with `pgvector` extension
  * `immich-redis`: Job queue and caching engine
* **Storage Location:** `./storage/immich/` (bind mount on host)

## Configuration & Access

* **URL:** `https://photos.<your-hostname>`
* **Quotas:** Automatically provisioned during setup; `homelab-admins` get unlimited quota, regular users receive `HOMELAB_DEFAULT_QUOTA_GB`.
* **Break-glass Admin:** `admin@<your-hostname>` (password in `volumes/secrets/immich_admin_password`).

## Verification & Commands

```bash
# Check Immich service stack
docker compose ps immich-server immich-machine-learning immich-redis immich-postgres

# View logs
docker compose logs immich-server --tail 50
```
