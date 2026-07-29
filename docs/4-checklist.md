## Post-installation checklist

Finish these after [`./setup.py`](../setup.py) succeeds. Check items off as you go.

**Hostnames:** examples use the default service URL names from setup (`auth`, `cloud`, `photos`, `dns`, `vault`, `notify`, `docker`, `status`, `office`, `mail`, `vpn`, `dashboard`). If you customized them, use the matching `*_SERVICE_NAME` values from `.env`.

**Passwords:** your Authentik / homelab password is the one you set during setup (`volumes/secrets/homelab_password`). App-specific break-glass secrets live under `volumes/secrets/`.

---

### DNS (Unbound + Pi-hole)

- [ ] Point clients (or your router) at the homelab for DNS — typically the server’s LAN IP (`HOMELAB_IP_ADDRESS`)
- [ ] Confirm recursive resolution works (Unbound behind Pi-hole)
- [ ] Open Pi-hole: `https://dns.<your-hostname>/admin` (or your `PIHOLE_SERVICE_NAME`)
- [ ] Tune blocklists if you want (replace/supplement defaults; [Hagezi Pro](https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt) is a common choice)
- [ ] Spot-check blocking with [AdBlock Tester](https://adblock-tester.com)
- [ ] Docs: [Pi-hole](https://docs.pi-hole.net/)

### Headscale (Tailscale VPN)

- [ ] Public DNS: a **single** DNS-only (grey-cloud) `A` record for `HEADSCALE_WEB_HOSTNAME` (usually `vpn.<your-hostname>`) → **this** host's public IP, updated by `ddclient` (no other `*.<your-hostname>` record is public)
- [ ] Router port forwards to the server: `443/tcp → 8443/tcp`, `3478/udp → 3478/udp`, `41641/udp → 41641/udp` (and **no** others)
- [ ] Confirm `https://vpn.<your-hostname>` responds (Headscale; bare `/` does not redirect to Authentik — OIDC starts from the Tailscale app login/register URL)
- [ ] From the internet, confirm another service host (e.g. `dashboard.<your-hostname>` as Host to the public IP) returns `404`/refused — not the app
- [ ] On each client, install [Tailscale](https://tailscale.com/download) and set the **custom control server** to `https://vpn.<your-hostname>`
- [ ] Sign in with Authentik (`homelab-users` / `homelab-admins`)
- [ ] Add a LAN gateway route for `HEADSCALE_IPV4_PREFIX` (default `100.64.0.0/24`) via the homelab server's LAN IP
- [ ] Verify remote clients can reach LAN IPs (subnet router advertises `LAN_SUBNET`) and DNS (Pi-hole via MagicDNS)
- [ ] Verify a LAN device can initiate a connection to a tailnet client address
- [ ] Confirm connections are direct (`tailscale status` shows `direct …:41641`, not `relay`) once NAT settles
- [ ] **Exit node (optional):** route all internet traffic through home
  - Mobile: Tailscale app → **Exit Nodes** → **homelab-router** (or the subnet-router node)
  - Desktop: tray icon → Exit Nodes → same
  - CLI: `tailscale up --exit-node=<node-name>`
  - Restrictive corporate firewalls that drop UDP may block Tailscale; turn the exit node off if the internet drops
- [ ] Docs: [Headscale](https://headscale.net/) · [Authentik + Headscale](https://integrations.goauthentik.io/networking/headscale/)

### CA certificate (private SSL mode only)

Skip if you use public Let’s Encrypt certificates.

Cert file: [`./volumes/certificates/homelab-ca.crt`](../volumes/certificates/)

- [ ] Copy `homelab-ca.crt` to each client (USB, SCP, etc.)
- [ ] **Windows:** Install Certificate → Local Machine → Trusted Root Certification Authorities
- [ ] **macOS:** Add to System keychain → Always Trust
- [ ] **Linux:** Debian/Ubuntu `update-ca-certificates` or Fedora/RHEL `update-ca-trust`
- [ ] **Firefox:** Import under Authorities and trust for websites (separate from OS store)
- [ ] **Android:** Install as a CA certificate (needed for Immich / Nextcloud / DAV apps on private TLS)
- [ ] **iOS / iPadOS:** Install profile, then enable full trust under Certificate Trust Settings

### Authentik

- [ ] Sign in at `https://auth.<your-hostname>`
- [ ] Confirm SSO apps appear (Dashboard, Vaultwarden, Nextcloud, Immich, Headscale, Dockhand, etc.)
- [ ] Prefer MFA here rather than per-app 2FA where possible
- [ ] Invite family/users into `homelab-users` (and `homelab-admins` only for SMB / Dockhand admin / unlimited quotas)
- [ ] Headscale OIDC: leave **Encryption Key** empty on the provider (Headscale does not support JWE)

### Homelab Dashboard

- [ ] Open `https://dashboard.<your-hostname>` — SSO should start automatically
- [ ] Confirm LAN/WOL, packages, word games, and secrets pages load for your account

### Vaultwarden

- [ ] Sign in with SSO using the **homelab email** printed by setup (`HOMELAB_EMAIL`) — password-reset mail is relayed by the alerts gateway → Gotify
- [ ] If asked for an SSO identifier, any string is fine
- [ ] Docs: [Vaultwarden](https://github.com/dani-garcia/vaultwarden/blob/main/README.md)

### Storage overview (Samba + Nextcloud + Immich + Mail)

Shared files live under [`./storage/`](../storage/) (gitignored; included in Restic):

| Path | Purpose |
| --- | --- |
| `storage/users/<username>/` | Private home (Samba `\\…\<username>`) |
| `storage/shared/` | Shared by everyone (Samba `\\…\shared`) |
| Nextcloud data | Everyday files / WebDAV / CalDAV / CardDAV / Mail UI |
| Immich upload | Photos/videos (not Nextcloud Photos) |

| Access | URL / path | Auth |
| --- | --- | --- |
| **SMB (LAN)** | `\\<HOMELAB_IP>\<username>` or `\\<IP>\shared` | Authentik **homelab-admins** only (NTLM synced when password is set in Authentik) |
| **Nextcloud** | `https://cloud.<hostname>` | Authentik OIDC — quota at login (`none` for admins, else `HOMELAB_DEFAULT_QUOTA_GB`) |
| **Immich** | `https://photos.<hostname>` | Authentik OIDC — same admin/default quota split |
| **Mail (IMAP/SMTP)** | `mail.<hostname>` :993 / :465 | Authentik LDAP (email + Authentik password) |
| **Office** | `https://office.<hostname>` | Via Nextcloud (Collabora) |

- [ ] Confirm Authentik users exist and LDAP outpost is healthy (`authentik-ldap`)
- [ ] Confirm `storage/users/` + `storage/shared/` exist
- [ ] Firewall for SMB (`445/tcp`) as needed; Docker Desktop/WSL may use `SAMBA_HOST_PORT=4445`
- [ ] Docs: [Nextcloud](https://docs.nextcloud.com/) · [Stalwart](https://stalw.art/docs/) · [Immich](https://immich.app/docs)

### Nextcloud (files + Office)

- [ ] Sign in at `https://cloud.<your-hostname>` via Authentik (first login creates the user)
- [ ] Confirm Files, Calendar, Contacts, Tasks, Mail, and Office (Collabora) work in the browser
- [ ] Create/open a `.odt` / `.ods` / `.odp` to verify Collabora (`https://office.<your-hostname>` is WOPI only — use Nextcloud as the UI)
- [ ] **Break-glass local admin** (if SSO is broken): `https://cloud.<your-hostname>/login?direct=1` → user `admin`, password `volumes/secrets/nextcloud_admin_password`
- [ ] Photos app is disabled on purpose — use Immich for photos

### Immich (photos)

- [ ] Open `https://photos.<your-hostname>` → **Authentik** (OIDC). First SSO login creates your library
- [ ] Confirm upload works in the browser
- [ ] **Mobile app:** Server URL = `https://photos.<your-hostname>` → sign in with Authentik / OAuth (install the Homelab CA on the phone if you use private TLS)
- [ ] Admins (`homelab-admins` / Immich admin) get unlimited quota; others get `HOMELAB_DEFAULT_QUOTA_GB`
- [ ] **Break-glass:** local admin email is `admin@<your-hostname>`, password `volumes/secrets/immich_admin_password` (created by setup)
- [ ] Docs: [Immich](https://immich.app/docs) · [Mobile app](https://immich.app/docs/overview/mobile-app)

### CalDAV / CardDAV / Tasks (Nextcloud)

Groupware lives in **Nextcloud** (same account as Files). Prefer clients that speak the **Nextcloud login flow** (browser SSO). Plain username/password only works for users that have a Nextcloud password (e.g. break-glass `admin`), not typical OIDC users.

**Discovery base (most clients):** `https://cloud.<your-hostname>`

| Protocol | Typical path |
| --- | --- |
| CalDAV | `https://cloud.<your-hostname>/remote.php/dav` |
| CardDAV | `https://cloud.<your-hostname>/remote.php/dav` |
| WebDAV (files) | `https://cloud.<your-hostname>/remote.php/dav/files/<username>/` |

- [ ] In the browser, open Calendar / Contacts / Tasks once so default calendars/address books exist
- [ ] **Android — [DAVx⁵](https://www.davx5.com/):** Add account → **Nextcloud** → base URL `https://cloud.<your-hostname>` → log in (browser / SSO) → enable Calendar, Contacts, and Tasks (JTX Board / OpenTasks / similar as needed)
- [ ] **iOS / macOS:** Settings → Calendar / Contacts → Add Account → **CalDAV** / **CardDAV** only works with a Nextcloud password or [app password](https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html). Prefer a Nextcloud-capable client, or create an app password under Nextcloud → Personal settings → Security, then use:
  - Server: `cloud.<your-hostname>`
  - Username: your Nextcloud username (usually Authentik username)
  - Password: app password (or break-glass `admin` password for testing)
- [ ] **Thunderbird:** Install TbSync + Provider for CalDAV & CardDAV (or built-in CalDAV), use the same base URL; for OIDC users use an app password
- [ ] **Windows:** Outlook does not do CalDAV natively — use [Outlook CalDav Synchronizer](https://caldavsynchronizer.org/) or keep Thunderbird / a phone
- [ ] Sync a test event and contact both ways
- [ ] Docs: [Nextcloud Calendar](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html) · [Contacts](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/contacts.html) · [DAVx⁵](https://www.davx5.com/manual/)

### Mail (Nextcloud Mail → Stalwart)

Stalwart has **no** built-in webmail. Setup enables **Nextcloud Mail** against `mail.<hostname>` (IMAPS 993 / SMTPS 465).

**Important:** Do **not** use Nextcloud Admin → Groupware → Mail “provisioning”. OIDC users have no IMAP password for that path; accounts fail and cannot be deleted in the UI. Use Nextcloud Mail’s own Add account (or rely on setup’s `mail:account:create` for the bootstrap user).

#### In the browser (Nextcloud Mail)

- [ ] Sign into Nextcloud via Authentik at least once (so your user exists)
- [ ] Open `https://cloud.<your-hostname>/apps/mail/`
- [ ] If setup already created your account: it should appear. Password used at create time is your **Authentik / homelab password**
- [ ] If no account yet (new user): **Mail → Add account**
  - Email: `you@<your-hostname>` (same as Authentik email, e.g. `andrew@homelab.home.arpa`)
  - Password: your **Authentik password** (not an Immich/Nextcloud-only secret)
  - Autoconfig often works via `https://autoconfig.<your-hostname>/mail/config-v1.1.xml` (also `/.well-known/…` on the apex). Manual:
    - IMAP: `mail.<your-hostname>`, port **993**, SSL/TLS
    - SMTP: `mail.<your-hostname>`, port **465**, SSL/TLS
- [ ] Send a test message to yourself; confirm Inbox
- [ ] After you change your Authentik password: Mail → **⋯** → **Account settings** → **Password** → paste the new Authentik password (IMAP stored password does not auto-update)

#### Desktop / phone mail apps (Thunderbird, Apple Mail, etc.)

- [ ] Account type: IMAP
- [ ] Email / username: your full address (`user@<your-hostname>`)
- [ ] Password: **Authentik password**
- [ ] Incoming: `mail.<your-hostname>:993` SSL/TLS
- [ ] Outgoing: `mail.<your-hostname>:465` SSL/TLS
- [ ] Trust the Homelab CA if using private TLS
- [ ] Docs: [Nextcloud Mail](https://docs.nextcloud.com/server/latest/user_manual/en/groupware/mail.html) · [Stalwart](https://stalw.art/docs/)

### Gotify / Alerts

- [ ] Open `https://notify.<your-hostname>` and sign in as **`alerts`** (password: `volumes/secrets/gotify_alerts_password`) — share this login with anyone who should see push alerts
- [ ] Install a Gotify client with the `alerts` account (not `admin`)
- [ ] Confirm per-service apps appear: Gatus, Dashboard, Vaultwarden, Dockhand, Mail, Homelab
- [ ] Confirm routed alerts arrive (Gatus → `http://alerts/gatus`, Dashboard packages → `http://alerts/dashboard`, Vaultwarden SMTP → Vaultwarden app, new mail → Stalwart webhook → Mail app)
- [ ] Keep `volumes/secrets/gotify_admin_password` for break-glass admin only
- [ ] Docs: [Gotify](https://gotify.net/docs/)

### Gatus

- [ ] Open `https://status.<your-hostname>` (no login — public read-only status page)
- [ ] Alerts are wired to `http://alerts/gatus` in [`services/gatus/config.yaml`](../services/gatus/config.yaml)
- [ ] Docs: [Gatus](https://gatus.io/)

### Dockhand

- [ ] Open `https://docker.<your-hostname>` → Authentik SSO (`homelab-admins` become Dockhand admins)
- [ ] Confirm compose containers are visible
- [ ] Break-glass local admin: user `admin`, password `volumes/secrets/dockhand_admin_password`
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

### ddclient

- [ ] Edit [`services/ddclient/volumes/ddclient.conf`](../services/ddclient/volumes/ddclient.conf) with your DDNS provider details (seeded from the example on setup)
- [ ] Recreate if you changed the file after first start: `docker compose up -d --force-recreate ddclient`
- [ ] Docs: [ddclient](https://ddclient.net/)

### Ollama

- [ ] Pull any models you want (`docker exec -it ollama ollama pull …`, or via the dashboard chatbot flow)
- [ ] Note: model data under `services/ollama/volumes/` is large and may be excluded from Restic — see [backup docs](./5-backup-restore.md)

### Backups

- [ ] Confirm Restic secrets exist under `volumes/secrets/restic_*` (configured during setup if you enabled cloud backup)
- [ ] Confirm the backup timer is active: `systemctl status homelab-backup.timer`
- [ ] Optional dry run: `python3 setup.py backup`
- [ ] Confirm `storage/` is included in snapshots
- [ ] Details: [5. Backup and Restore](./5-backup-restore.md)

---

### Done

You are set for day-to-day use. Next: backups, development mode, or troubleshooting.

## Next: 5. Backup and Restore

[Continue to backup and restore](./5-backup-restore.md)
