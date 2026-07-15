## Post-installation checklist

Finish these steps after [`setup.sh`](../setup.sh) succeeds. Check off each item as you go.

### DNS (Unbound + Pi-hole)

- [ ] Point clients (or your router) at the homelab for DNS — typically the server’s LAN IP
- [ ] Confirm recursive resolution works (Unbound behind Pi-hole)
- [ ] Tune Pi-hole blocklists if you want (replace/supplement defaults; [Hagezi Pro](https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt) is a common choice)
- [ ] Spot-check blocking with [AdBlock Tester](https://adblock-tester.com)
- [ ] Docs: [Pi-hole](https://docs.pi-hole.net/)

### WireGuard

- [ ] Install peer configs from host WireGuard setup on each remote device
- [ ] Verify VPN clients can reach LAN services and DNS
- [ ] Docs: [WireGuard quickstart](https://www.wireguard.com/quickstart/)

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
- [ ] Confirm SSO apps appear (Dashboard, Nextcloud, Vaultwarden, Gatus, Dockhand, Gotify, RustDesk console, etc.)
- [ ] Prefer MFA here rather than per-app 2FA where possible

### Homelab Dashboard

- [ ] Open `https://dashboard.<your-hostname>` (or the Authentik app launcher) — SSO should start automatically when enabled
- [ ] Confirm LAN/WOL, packages, word games, and secrets pages load for your account
- [ ] Local login escape (if local auth is enabled): `/?local=1`

### Vaultwarden

- [ ] Sign in with SSO using the **homelab email** printed by setup (`HOMELAB_EMAIL`) — password-reset mail is relayed by Apprise → Gotify
- [ ] If asked for an SSO identifier, any string is fine
- [ ] Docs: [Vaultwarden](https://github.com/dani-garcia/vaultwarden/blob/main/README.md)

### Nextcloud

- [ ] Sign in with Authentik SSO at `https://nextcloud.<your-hostname>` (account is provisioned on first login)
- [ ] Confirm members of `homelab-admins` land in Nextcloud’s **admin** group
- [ ] Open an Office file to verify Collabora (`https://collabora.<your-hostname>`; admin secret in `volumes/secrets/collabora_admin_password`)
- [ ] Optional break-glass local admin: `/login?direct=1` (password in `volumes/secrets/nextcloud_admin_password`)
- [ ] Docs: [Nextcloud](https://docs.nextcloud.com/) · [Authentik + Nextcloud](https://integrations.goauthentik.io/chat-communication-collaboration/nextcloud/)

### Gotify

- [ ] Open `https://gotify.<your-hostname>` (Authentik-protected) and install a client / grant notifications
- [ ] Confirm Apprise-routed alerts arrive (Gatus and SMTP-relayed mail use this path)
- [ ] Keep the admin password from `volumes/secrets/gotify_admin_password` for break-glass
- [ ] Docs: [Gotify](https://gotify.net/docs/)

### Gatus

- [ ] Open `https://gatus.<your-hostname>` via SSO and skim endpoint status
- [ ] Alerts are already wired to Apprise (`http://apprise-api/alerts/gatus`) in [`gatus/config.yaml`](../gatus/config.yaml) — adjust only if you change monitoring
- [ ] Docs: [Gatus](https://gatus.io/)

### Dockhand

- [ ] Open `https://dockhand.<your-hostname>` via SSO
- [ ] Confirm containers from the compose stack are visible
- [ ] Optional: point Dockhand notifications at `http://apprise-api/alerts/dockhand`
- [ ] Docs: [Dockhand](https://github.com/Finsys/dockhand)

### RustDesk

- [ ] Set **ID/Relay Server** to your host IP or domain
- [ ] Set public key from setup output, dashboard Secrets (`rustdesk_public_key`), or [`./volumes/secrets/rustdesk_public_key`](../volumes/secrets/rustdesk_public_key)
- [ ] Set **API Server** to `https://rustdesk.<your-hostname>` (no `/_admin/`)
- [ ] Web console SSO only: sign in once at `https://rustdesk.<your-hostname>/_admin/` with Authentik to create your user
- [ ] In the console, set a password under **My Space → My info → Change Password**, then use that username/password in desktop/mobile apps (apps do not use Authentik SSO)
- [ ] Break-glass admin password: `volumes/secrets/rustdesk_admin_password`
- [ ] Docs: [RustDesk](https://rustdesk.com/docs/) · [rustdesk-console](https://github.com/dockers-x/rustdesk-console)

### ddclient

- [ ] Edit [`ddclient/volumes/ddclient.conf`](../ddclient/volumes/ddclient.conf) with your DDNS provider details (seeded from the example on setup)
- [ ] Recreate the container if you changed the file after first start: `docker compose up -d --force-recreate ddclient`
- [ ] Docs: [ddclient](https://ddclient.net/)

### Ollama

- [ ] Pull any models you want (`ollama pull …` in the container or via the dashboard chatbot flow)
- [ ] Note: model data under `ollama/volumes/` is large and may be excluded from Restic — see [backup docs](./5-backup-restore.md)

### Backups

- [ ] Confirm Restic secrets exist under `volumes/secrets/restic_*` (configured during setup if you enabled cloud backup)
- [ ] Confirm the backup timer is active: `systemctl status homelab-backup.timer` (installed by setup)
- [ ] Optional dry run: `python3 setup.py backup`
- [ ] Details: [5. Backup and Restore](./5-backup-restore.md)

---

### Done

You are set for day-to-day use. Next: backups, development mode, or troubleshooting.

## Next: 5. Backup and Restore

[Continue to backup and restore](./5-backup-restore.md)
