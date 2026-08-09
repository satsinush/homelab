# 🔐 Vaultwarden Password Manager

Vaultwarden is a lightweight implementation of the Bitwarden server API written in Rust.

* **Official Documentation:** [github.com/dani-garcia/vaultwarden/wiki](https://github.com/dani-garcia/vaultwarden/wiki)

---

## Overview

Vaultwarden provides secure password storage, secure notes, and credential sharing across devices using official Bitwarden mobile, desktop, and browser extensions.

## Architecture & Storage

* **Container Name:** `vaultwarden` (`vault.<your-hostname>`)
* **Database:** SQLite database stored at `services/vaultwarden/volumes/data/db.sqlite3`
* **Backup Strategy:** Online SQLite `.backup` API executed during automated Restic snapshots.

## Configuration & Access

* **URL:** `https://vault.<your-hostname>`
* **Authentik SSO:** Uses Authentik OIDC for user sign-in.
* **Email & Password Resets:** Routes outbound emails through the internal alerts SMTP gateway (`http://alerts`).

## Verification

```bash
# Check Vaultwarden container status
docker compose ps vaultwarden

# View logs
docker compose logs vaultwarden --tail 50
```
