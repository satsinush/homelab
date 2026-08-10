# 🔑 Authentik Identity Provider

Authentik serves as the central Single Sign-On (SSO), Identity Provider (IdP), and LDAP provider for all homelab applications.

* **Official Documentation:** [goauthentik.io/docs](https://goauthentik.io/docs/)

---

## Overview

Authentik manages user authentication, multi-factor authentication (MFA), group-based authorization (`homelab-users` and `homelab-admins`), OIDC providers for web apps, and an LDAP outpost for non-OIDC services (Samba, Stalwart).

## Architecture & Containers

* **Containers:**
  * `authentik-server`: Core web application server (`auth.<your-hostname>`)
  * `authentik-worker`: Background task processing worker
  * `authentik-ldap`: Embedded LDAP outpost listening on port `3389`
* **Database:** PostgreSQL (`authentik-postgres`) + Redis (`authentik-redis`)
* **Blueprints:** `./services/authentik/blueprints/homelab.yaml` automatically provisions groups, users, OIDC applications, and LDAP outposts on initial setup.

## Integrated Services

| App | Auth Protocol | Admin Requirement | Default Quota / Access |
| --- | --- | --- | --- |
| **Dashboard** | OIDC | Full access | All authenticated users |
| **Nextcloud** | OIDC | `admin` group | `HOMELAB_DEFAULT_QUOTA_GB` (Unlimited for admins) |
| **Immich** | OIDC | Admin role | `HOMELAB_DEFAULT_QUOTA_GB` (Unlimited for admins) |
| **Headscale** | OIDC | Allowed groups | `homelab-users`, `homelab-admins` |
| **Dockhand** | OIDC | Admin role | `homelab-admins` only |
| **Vaultwarden** | OIDC | SSO login | Password reset via homelab email |
| **Samba** | LDAP | Admin access | `homelab-admins` only (`shared` + home share) |
| **Stalwart** | LDAP | Mail user | Authentik password authentication |

## Admin & Secrets

* **Web UI:** `https://auth.<your-hostname>`
* **Break-glass Admin:** `akadmin` / password in `volumes/secrets/authentik_admin_password`
* **LDAP Outpost:** `ldap://authentik-ldap:3389` (Bind DN secret in `volumes/secrets/ldap_service_password`)

## Verification

```bash
# Check Authentik server and worker containers
docker compose ps authentik-server authentik-worker authentik-ldap

# View Authentik startup / blueprint logs
docker compose logs authentik-server --tail 50
```
