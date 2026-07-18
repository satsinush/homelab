## Post-installation checklist

Finish these steps after [`setup.sh`](../setup.sh) succeeds. Check off each item as you go.

### DNS (Unbound + Pi-hole)

- [ ] Point clients (or your router) at the homelab for DNS — typically the server’s LAN IP
- [ ] Confirm recursive resolution works (Unbound behind Pi-hole)
- [ ] Tune Pi-hole blocklists if you want (replace/supplement defaults; [Hagezi Pro](https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt) is a common choice)
- [ ] Spot-check blocking with [AdBlock Tester](https://adblock-tester.com)
- [ ] Docs: [Pi-hole](https://docs.pi-hole.net/)

### Headscale (Tailscale VPN)

- [ ] Public DNS: a **single** DNS-only (grey-cloud) `A` record `vpn.<your-hostname>` → public IP, updated by `ddclient` (no other `*.<your-hostname>` record is public)
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

### Storage (Samba + WebDAV)

Shared files live under [`./storage/`](../storage/) (gitignored; included in Restic):

| Path | Purpose |
| --- | --- |
| `storage/users/<username>/` | Private home (Samba `\\…\<username>`, WebDAV `/`) |
| `storage/shared/` | Shared by everyone (Samba `\\…\shared`, WebDAV `/shared` virtual folder) |

| Access | URL / path | Password |
| --- | --- | --- |
| **SMB (LAN)** | `\\<HOMELAB_IP>\<username>` or `\\<IP>\shared` | Shared file password (`volumes/file-accounts/accounts.env`) |
| **WebDAV** | `https://dav.<your-hostname>/` | **Same** file password (SFTPGo loads from that accounts file) |

- [ ] Firewall for SMB (`445/tcp` on local + vpn zones) is applied by the [Ansible playbook](../ansible/README.md) — verify with `sudo firewall-cmd --zone=local --list-services`. On Docker Desktop/WSL, Samba is published as `4445` (Windows already owns `445`); **Windows Explorer cannot open `\\host:4445\…`** — use WebDAV from Windows, or SMB clients that allow a custom port. Pi uses real `445`.
- [ ] Confirm file-access user(s) exist (`volumes/file-accounts/accounts.env`) and dirs under `storage/users/` + `storage/shared/`
- [ ] New person checklist: Authentik account (SSO) → file-access user in `accounts.env` (SMB + WebDAV)
- [ ] **Obsidian / WebDAV Sync:** server `https://dav.<your-hostname>/`, **file-access** credentials (not Authentik); vault under private home; shared files at `/shared`
- [ ] Docs: [Samba](https://www.samba.org/) · [SFTPGo](https://docs.sftpgo.com/)

### Gotify / Alerts

- [ ] Open `https://gotify.<your-hostname>` and sign in as **`alerts`** (password: `volumes/secrets/gotify_alerts_password`) — share this login with anyone who should see push alerts
- [ ] Install a Gotify client with the `alerts` account (not `admin`)
- [ ] Confirm per-service apps appear: Gatus, Dashboard, Vaultwarden, Dockhand, Homelab (each with its own icon)
- [ ] Confirm routed alerts arrive (Gatus → `http://alerts/gatus`, Dashboard packages → `http://alerts/dashboard`, Vaultwarden SMTP → Vaultwarden app)
- [ ] Keep `volumes/secrets/gotify_admin_password` for break-glass admin only
- [ ] Docs: [Gotify](https://gotify.net/docs/)

### Gatus

- [ ] Open `https://gatus.<your-hostname>` (no login — public read-only status page)
- [ ] Alerts are already wired to the alerts gateway (`http://alerts/gatus`) in [`gatus/config.yaml`](../gatus/config.yaml) — adjust only if you change monitoring
- [ ] Docs: [Gatus](https://gatus.io/)

### Dockhand

- [ ] Open `https://dockhand.<your-hostname>` via SSO
- [ ] Confirm containers from the compose stack are visible
- [ ] Optional: point Dockhand notifications at `http://alerts/dockhand`
- [ ] Docs: [Dockhand](https://github.com/Finsys/dockhand)

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

### CalDAV & CardDAV (Calendar/Contacts)

Sync contacts and calendars using **Radicale** over HTTPS. Accounts and credentials are unified with Samba/WebDAV via the Dashboard.

- [ ] Confirm you have set a local password for your account in the dashboard.
- [ ] Connect your client (e.g., iOS, macOS, Thunderbird) to `https://dav.<your-hostname>/radicale/` using your username and local sync password.
- [ ] Client Account Setup:
  - **iOS / macOS**: Add account type **CalDAV** or **CardDAV** -> select **Manual** -> enter Server Address `dav.<your-hostname>`, username, and password. (Apple devices will automatically discover calendars/contacts via Traefik redirects).
  - **Android**: Install the open-source **DAVx⁵** sync adapter. Add account -> select **Login with URL and user name** -> Base URL `https://dav.<your-hostname>/radicale/`, username, and password. DAVx⁵ will auto-sync contacts/calendars directly into Android's native system apps.
  - **Windows (Thunderbird)**: Open Calendar -> New Calendar -> **On the Network** -> Username, and Location `https://dav.<your-hostname>/radicale/<username>/`.
  - **Windows (Outlook)**: Outlook requires a third-party plugin such as the open-source **Outlook CalDAV Synchronizer** to sync calendars and contacts.
- [ ] Docs: [Radicale](https://radicale.org/)

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
- [ ] Confirm `storage/` is included in snapshots (homes / Samba / WebDAV data)
- [ ] Details: [5. Backup and Restore](./5-backup-restore.md)

---

### Done

You are set for day-to-day use. Next: backups, development mode, or troubleshooting.

## Next: 5. Backup and Restore

[Continue to backup and restore](./5-backup-restore.md)
