# 📚 Services Directory & Architecture Index

This catalog provides an overview of all 19 services deployed in the homelab environment, complete with default subdomains, access levels, links to internal README documents, and links to official documentation websites.

---

## Service Catalog

| Icon | Service Name | Default Subdomain | Access Level | Internal README | Official Documentation |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 🔀 | **Traefik** | Internal Edge Proxy | Edge Router | [Traefik README](../services/traefik/README.md) | [doc.traefik.io/traefik](https://doc.traefik.io/traefik/) |
| 🔑 | **Authentik** | `auth.<hostname>` | SSO Provider | [Authentik README](../services/authentik/README.md) | [goauthentik.io/docs](https://goauthentik.io/docs/) |
| 🏠 | **Homelab Dashboard** | `dashboard.<hostname>` | Authentik SSO | [Dashboard README](../services/dashboard/README.md) | *Internal / Custom application* |
| ☁️ | **Nextcloud** | `cloud.<hostname>` | Authentik SSO | [Nextcloud README](../services/nextcloud/README.md) | [docs.nextcloud.com](https://docs.nextcloud.com/) |
| 📷 | **Immich** | `photos.<hostname>` | Authentik SSO | [Immich README](../services/immich/README.md) | [immich.app/docs](https://immich.app/docs/) |
| 🔐 | **Vaultwarden** | `vault.<hostname>` | Authentik SSO | [Vaultwarden README](../services/vaultwarden/README.md) | [github.com/dani-garcia/vaultwarden/wiki](https://github.com/dani-garcia/vaultwarden/wiki) |
| ✉️ | **Stalwart** | `mail.<hostname>` | LDAP Auth | [Stalwart README](../services/stalwart/README.md) | [stalw.art/docs](https://stalw.art/docs/) |
| 🛰️ | **Headscale** | `vpn.<hostname>` | Authentik SSO / OIDC | [Headscale README](../services/headscale/README.md) | [headscale.net](https://headscale.net/) |
| 📁 | **Samba** | Host LAN (SMB) | LDAP Auth (`homelab-admins`) | [Samba README](../services/samba/README.md) | [samba.org/samba/docs](https://www.samba.org/samba/docs/) |
| 📈 | **Gatus** | `status.<hostname>` | Public Read-Only | [Gatus README](../services/gatus/README.md) | [gatus.io](https://gatus.io/) |
| 🔔 | **Gotify** | `notify.<hostname>` | Internal / Alerts User | [Gotify README](../services/gotify/README.md) | [gotify.net/docs](https://gotify.net/docs/) |
| 📦 | **Dockhand** | `docker.<hostname>` | Authentik SSO (`homelab-admins`) | [Dockhand README](../services/dockhand/README.md) | [github.com/dockhand-dev/dockhand](https://github.com/dockhand-dev/dockhand) |
| 🚫 | **Pi-hole** | `dns.<hostname>` | Admin Password | [Pi-hole README](../services/pihole/README.md) | [docs.pi-hole.net](https://docs.pi-hole.net/) |
| 🔎 | **Unbound** | Internal DNS (`:5335`) | Internal Container Network | [Unbound README](../services/unbound/README.md) | [unbound.docs.nlnetlabs.nl](https://unbound.docs.nlnetlabs.nl/) |
| 🤖 | **Ollama** | Internal API (`:11434`)| Dashboard API | [Ollama README](../services/ollama/README.md) | [github.com/ollama/ollama/tree/main/docs](https://github.com/ollama/ollama/tree/main/docs) |
| 🖥️ | **RustDesk** | Host Ports (`21115-21117`)| Client Encryption Key | [RustDesk README](../services/rustdesk/README.md) | [rustdesk.com/docs](https://rustdesk.com/docs/) |
| 🌐 | **ddclient** | Background Daemon | Internal DDNS Daemon | [ddclient README](../services/ddclient/README.md) | [ddclient.net](https://ddclient.net/) |
| 💾 | **Restic** | Background / Systemd | Admin Host CLI / Systemd | [Restic README](../services/restic/README.md) | [restic.readthedocs.io](https://restic.readthedocs.io/) |
| 🔔 | **Alerts** | Internal HTTP Gateway | Internal Container Network | [Alerts README](../services/alerts/README.md) | *Internal / Custom HTTP Webhook Gateway* |

---

## Infrastructure Summary

All services run inside Docker containers attached to the private `homelab-net` network. Traefik handles edge TLS termination, routing HTTP/HTTPS requests to container service ports based on labels defined in each service's `compose.yaml`.
