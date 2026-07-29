## Post-installation checklist

Finish these steps after [`setup.sh`](../setup.sh) succeeds. Check off each item as you go.

### DNS (Unbound + Pi-hole)

- [ ] Point clients (or your router) at the homelab for DNS — typically the server’s LAN IP
- [ ] Confirm recursive resolution works (Unbound behind Pi-hole)
- [ ] Tune Pi-hole blocklists if you want (replace/supplement defaults; [Hagezi Pro](https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt) is a common choice)
- [ ] Spot-check blocking with [AdBlock Tester](https://adblock-tester.com)
- [ ] Docs: [Pi-hole](https://docs.pi-hole.net/)

### Headscale (Tailscale VPN)

- [ ] Public DNS: a **single** DNS-only (grey-cloud) `A` record for `HEADSCALE_WEB_HOSTNAME` (usually `vpn.<your-hostname>`) → **this** host's public IP, updated by `ddclient` (no other `*.<your-hostname>` record is public)
- [ ] Router port forwards to the server: `443/tcp → 8443/tcp`, `3478/udp → 3478/udp`, `41641/udp → 41641/udp` (and **no** others)
- [ ] Confirm `https://vpn.<your-hostname>` loads (OIDC redirects to Authentik)
- [ ] From the internet, confirm another service host (e.g. `dashboard.<your-hostname>` sent as a Host header to the public IP) returns `404`/refused — not the app
- [ ] On each client, install [Tailscale](https://tailscale.com/download) and set the **custom control server** to `https://vpn.<your-hostname>`
- [ ] Sign in with Authentik (`homelab-users` / `homelab-admins`)
- [ ] Add a LAN gateway route for `HEADSCALE_IPV4_PREFIX` (default `100.64.0.0/24`) via the homelab server's LAN IP
- [ ] Verify remote clients can reach LAN IPs (subnet router advertises `LAN_SUBNET`) and DNS (Pi-hole via MagicDNS)
- [ ] Verify a LAN device can initiate a connection to a tailnet client address
- [ ] Confirm connections are direct (`tailscale status` shows `direct …:41641`, not `relay`) once NAT settles
- [ ] **Exit Node Routing (Optional)**: Route all internet traffic through your home Pi server (useful for securing public or corporate Wi-Fi):
  - The subnet router (`headscale-router`) is automatically configured to advertise as an exit node and approved during setup.
  - **Mobile (iOS/Android)**: In the Tailscale app, select **homelab-router** under *Exit Nodes* and toggle it on.
  - **Desktop (Windows/macOS)**: Click the Tailscale tray icon, find *Exit Nodes*, and select **homelab-router**.
  - **CLI (Linux/macOS)**: Run `tailscale up --exit-node=homelab-router`.
  - *Note*: Restrictive corporate firewalls that drop UDP packets may block Tailscale entirely. If internet drops when using the exit node, simply turn it back off.
- [ ] Docs: [Headscale](https://headscale.net/) · [Authentik + Headscale](https://integrations.goauthentik.io/networking/headscale/)

### CA certificate (private SSL mode only)

Skip this section if you use public Let’s Encrypt certificates.

Cert file: [`./volumes/certificates/homelab-ca.crt`](../volumes/certificates/)

- [ ] Copy `homelab-ca.crt` to each client (USB, SCP, etc.)
- [ ] **Windows:** Install Certificate → Local Machine → Trusted Root Certification Authorities
- [ ] **macOS:** Add to System keychain → Always Trust
- [ ] **Linux:** Debian/Ubuntu `update-ca-certificates` or Fedora/RHEL `update-ca-trust`
- [ ] **Firefox:** Import under Authorities and trust for websites (separate from OS store)
- [ ] **Android:** Install as a CA certificate
- [ ] **iOS / iPadOS:** Install profile, then enable full trust under Certificate Trust Settings

### Authentik

- [ ] Sign in at `https://authentik.<your-hostname>`
- [ ] Confirm SSO apps appear (Dashboard, Vaultwarden, Headscale, Dockhand, Gotify, etc.)
- [ ] Prefer MFA here rather than per-app 2FA where possible
- [ ] Headscale OIDC: leave **Encryption Key** empty on the provider (Headscale does not support JWE)

### Homelab Dashboard

- [ ] Open `https://dashboard.<your-hostname>` (or the Authentik app launcher) — SSO should start automatically when enabled
- [ ] Confirm LAN/WOL, packages, word games, and secrets pages load for your account
- [ ] Local login escape (if local auth is enabled): `/?local=1`

### Vaultwarden

- [ ] Sign in with SSO using the **homelab email** printed by setup (`HOMELAB_EMAIL`) — password-reset mail is relayed by the alerts gateway → Gotify
- [ ] If asked for an SSO identifier, any string is fine
- [ ] Docs: [Vaultwarden](https://github.com/dani-garcia/vaultwarden/blob/main/README.md)

### Storage (Samba + Nextcloud)

Shared files live under [`./storage/`](../storage/) (gitignored; included in Restic):

| Path | Purpose |
| --- | --- |
| `storage/users/<username>/` | Private home (Samba `\\…\<username>`) |
| `storage/shared/` | Shared by everyone (Samba `\\…\shared`) |
| Nextcloud data | Everyday files / WebDAV / CalDAV / CardDAV / Mail (via Stalwart) |

| Access | URL / path | Auth |
| --- | --- | --- |
| **SMB (LAN)** | `\\<HOMELAB_IP>\<username>` or `\\<IP>\shared` | Authentik **homelab-admins** only (NTLM synced on password set; no SMB quota) |
| **Nextcloud** | `https://cloud.<hostname>` | Authentik OIDC — quota claim at login (`none` for `homelab-admins`, else `HOMELAB_DEFAULT_QUOTA_GB`) |
| **Mail** | `mail.<hostname>` IMAPS 993 / SMTPS 465 | Authentik LDAP (humans + `vaultwarden@` / `noreply@` service accounts) |
| **Photos** | `https://photos.<hostname>` | Authentik OIDC — quota/role claims at account creation (same admin/default split) |
| **Office** | `https://office.<hostname>` | Via Nextcloud (Collabora) |

- [ ] Confirm Authentik users exist and LDAP outpost is healthy (`authentik-ldap`)
- [ ] Copy LDAP Outpost token into `volumes/secrets/ldap_outpost_token` if auto-extract failed
- [ ] Confirm Stalwart postsetup wired LDAP + Homelab TLS on `mail.<hostname>`, and Authentik has `vaultwarden@` / `noreply@` (blueprint / re-run setup)
- [ ] Confirm `storage/users/` + `storage/shared/` exist
- [ ] Firewall for SMB (`445/tcp`) as needed; Docker Desktop/WSL may use `SAMBA_HOST_PORT=4445`
- [ ] Docs: [Nextcloud](https://docs.nextcloud.com/) · [Stalwart](https://stalw.art/docs/) · [Immich](https://immich.app/docs)

### Gotify / Alerts

- [ ] Open `https://gotify.<your-hostname>` and sign in as **`alerts`** (password: `volumes/secrets/gotify_alerts_password`) — share this login with anyone who should see push alerts
- [ ] Install a Gotify client with the `alerts` account (not `admin`)
- [ ] Confirm per-service apps appear: Gatus, Dashboard, Vaultwarden, Dockhand, Homelab (each with its own icon)
- [ ] Confirm routed alerts arrive (Gatus → `http://alerts/gatus`, Dashboard packages → `http://alerts/dashboard`, Vaultwarden SMTP → Vaultwarden app, new mail → Stalwart webhook → Mail app)
- [ ] Keep `volumes/secrets/gotify_admin_password` for break-glass admin only
- [ ] Docs: [Gotify](https://gotify.net/docs/)

### Gatus

- [ ] Open `https://gatus.<your-hostname>` (no login — public read-only status page)
- [ ] Alerts are already wired to the alerts gateway (`http://alerts/gatus`) in [`gatus/config.yaml`](../services/gatus/config.yaml) — adjust only if you change monitoring
- [ ] Docs: [Gatus](https://gatus.io/)

### Dockhand

- [ ] Open `https://dockhand.<your-hostname>` → Authentik SSO (native OIDC; `homelab-admins` become Dockhand admins)
- [ ] Confirm containers from the compose stack are visible
- [ ] Optional: point Dockhand notifications at `http://alerts/dockhand`
- [ ] Docs: [Dockhand](https://github.com/Finsys/dockhand) · [OIDC](https://finsys-dockhand.mintlify.app/auth/oidc)

### RustDesk

Client **Network** → **ID/Relay server** (and key). There is **no** API/console in this stack — ID + relay only.

| Field | Recommended value | Notes |
| --- | --- | --- |
| **ID server** | Host LAN IP (`HOMELAB_IP_ADDRESS`), port `21116` | Prefer IP over domain |
| **Relay server** | Same IP (`21117`) or leave blank if hbbs advertises `-r` | |
| **API server** | Leave blank | |
| **Key** | [`volumes/secrets/rustdesk_public_key`](../volumes/secrets/rustdesk_public_key) | Must match `docker logs rustdesk-id-server` |

- [ ] Fill ID (+ optional Relay) and paste the public key
- [ ] Confirm a remote works by ID/password
- [ ] Docs: [RustDesk](https://rustdesk.com/docs/)

### CalDAV & CardDAV (Calendar/Contacts/Tasks)

Use **Nextcloud** (same Authentik SSO as the web UI).

- [ ] Open `https://cloud.<your-hostname>` and confirm Calendar / Contacts / Tasks apps are enabled
- [ ] Clients: CalDAV/CardDAV base URLs from Nextcloud → Settings → Calendar/Contacts (or DAVx⁵ Nextcloud login)
- [ ] Docs: [Nextcloud Calendar](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html)

### Mail (Nextcloud Mail → Stalwart)

Stalwart has no built-in webmail. Postsetup enables **Nextcloud Mail** against
`mail.<hostname>` (IMAPS/SMTPS, Homelab CA verified) and creates your mailbox
with `mail:account:create` (Authentik password). **Do not** use Admin →
Groupware → Mail provisioning — OIDC logins cannot supply an IMAP password, so
provisioned accounts fail and cannot be deleted in the UI.

- [ ] Open `https://cloud.<your-hostname>/apps/mail/` (SSO)
- [ ] Account host is `mail.<your-hostname>` (not the Docker service name)
- [ ] Autoconfig: `https://autoconfig.<hostname>/mail/config-v1.1.xml` (also `/.well-known/…` on the apex) — Mail “Add account” can detect IMAP/SMTP from your email domain
- [ ] Password for Mail is your **Authentik / homelab password**
- [ ] To change the stored Mail password: Mail → **⋯** → **Account settings** → **Password**
- [ ] Send a test message to yourself; confirm it appears in Inbox
- [ ] Docs: [Nextcloud Mail](https://docs.nextcloud.com/server/latest/admin_manual/groupware/mail.html) · [Stalwart](https://stalw.art/docs/)

### ddclient

- [ ] Edit [`ddclient/volumes/ddclient.conf`](../services/ddclient/volumes/ddclient.conf) with your DDNS provider details (seeded from the example on setup)
- [ ] Recreate the container if you changed the file after first start: `docker compose up -d --force-recreate ddclient`
- [ ] Docs: [ddclient](https://ddclient.net/)

### Ollama

- [ ] Pull any models you want (`ollama pull …` in the container or via the dashboard chatbot flow)
- [ ] Note: model data under `ollama/volumes/` is large and may be excluded from Restic — see [backup docs](./5-backup-restore.md)

### Backups

- [ ] Confirm Restic secrets exist under `volumes/secrets/restic_*` (configured during setup if you enabled cloud backup)
- [ ] Confirm the backup timer is active: `systemctl status homelab-backup.timer` (installed by setup)
- [ ] Optional dry run: `python3 setup.py backup`
- [ ] Confirm `storage/` is included in snapshots (homes / Samba / Nextcloud bulk paths as configured)
- [ ] Details: [5. Backup and Restore](./5-backup-restore.md)

---

### Done

You are set for day-to-day use. Next: backups, development mode, or troubleshooting.

## Next: 5. Backup and Restore

[Continue to backup and restore](./5-backup-restore.md)
