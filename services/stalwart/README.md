# ✉️ Stalwart Mail Server

Stalwart is a modern, unified IMAP and SMTP mail server.

* **Official Documentation:** [stalw.art/docs](https://stalw.art/docs/)

---

## Overview

Stalwart provides mail transport and mailbox storage. It authenticates user credentials directly against Authentik's LDAP outpost (`authentik-ldap:3389`).

## Architecture & Certificates

* **Container Name:** `mail` (`mail.<your-hostname>`)
* **LDAP Integration:** Configured to query `authentik-ldap` on port `3389` for user mailboxes and password authentication.
* **TLS Certificate Sync:** TLS certificates are dumped automatically by `traefik-certs-dumper` into `volumes/certificates/stalwart-tls/`.

## Ports & TLS

| Port | Protocol | Purpose | TLS |
| --- | --- | --- | --- |
| `993` | IMAPS | Secure IMAP mailbox access | Implicit TLS (bypasses Traefik) |
| `465` | SMTPS | Secure SMTP message submission | Implicit TLS (bypasses Traefik) |

## Clients & Webmail

* **Webmail:** Use Nextcloud Mail (`https://cloud.<your-hostname>/apps/mail/`).
* **Desktop/Mobile Apps:** Connect to `mail.<your-hostname>` on ports `993` (IMAP) and `465` (SMTP) using your full email address and Authentik password.

## Verification

```bash
# Check Stalwart container status
docker compose ps mail

# View mail server logs
docker compose logs mail --tail 50
```
