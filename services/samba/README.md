# 📁 Samba SMB File Shares

Samba provides high-performance LAN file sharing for Windows, macOS, and Linux clients.

* **Official Documentation:** [samba.org/samba/docs](https://www.samba.org/samba/docs/)

---

## Overview

Samba exports user home directories and shared folders. User identities and passwords are kept in sync with Authentik via LDAP.

## Architecture & Configuration

* **Container Name:** `samba`
* **Configuration:** Managed dynamically by `services/samba/setup.py` writing local passdb pass-through configuration.
* **Storage Paths:** User home shares point to `./storage/users/<username>/` and shared folder points to `./storage/shared/`.

## Shares

| Share Name | UNC Path | Access | Storage Directory |
| --- | --- | --- | --- |
| `<username>` | `\\<HOMELAB_IP>\<username>` | User private home | `./storage/users/<username>/` |
| `shared` | `\\<HOMELAB_IP>\shared` | Read/Write for `homelab-admins` | `./storage/shared/` |

## Authentication

* Restricted to members of the **`homelab-admins`** Authentik group.
* Requires user password synchronization in Authentik (or local smbpasswd bootstrap during `setup.py`).

## Verification

```bash
# Check Samba container status
docker compose ps samba

# Test SMB connect locally (if smbclient installed)
smbclient -L //localhost -U <username>
```
