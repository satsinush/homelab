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
- [ ] Confirm SSO apps appear (Dashboard, Vaultwarden, Gatus, Dockhand, Gotify, LDAP app, etc.)
- [ ] Prefer MFA here rather than per-app 2FA where possible
- [ ] LDAP Outpost: after containers are up, `authentik` postsetup copies the managed outpost token into `volumes/secrets/authentik_ldap_outpost_token` (or Admin → Outposts → LDAP Outpost → View Deployment Info)
- [x] `ldapservice` has **Search full LDAP directory** on the LDAP provider (blueprint object permission)

### Homelab Dashboard

- [ ] Open `https://dashboard.<your-hostname>` (or the Authentik app launcher) — SSO should start automatically when enabled
- [ ] Confirm LAN/WOL, packages, word games, and secrets pages load for your account
- [ ] Local login escape (if local auth is enabled): `/?local=1`

### Vaultwarden

- [ ] Sign in with SSO using the **homelab email** printed by setup (`HOMELAB_EMAIL`) — password-reset mail is relayed by Apprise → Gotify
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
| **SMB (LAN)** | `\\<HOMELAB_IP>\<username>` or `\\<IP>\shared` | **Samba-local** (`samba/volumes/config/accounts.env`) — not Authentik |
| **WebDAV** | `https://dav.<your-hostname>/` | **Authentik** username + password (LDAP) |

- [ ] Open firewall for SMB: `445/tcp` on local + vpn zones (see [host config](./2-host-config.md)). On Docker Desktop/WSL, Samba is published as `4445` (Windows already owns `445`); **Windows Explorer cannot open `\\host:4445\…`** — use WebDAV from Windows, or SMB clients that allow a custom port. Pi uses real `445`.
- [ ] Confirm Samba user(s) exist (`samba/volumes/config/accounts.env`) and dirs under `storage/users/` + `storage/shared/`
- [ ] New person checklist: Authentik account (WebDAV works on first login) → optional Samba user if they need LAN SMB
- [ ] **Obsidian Remotely Save:** server `https://dav.<your-hostname>/`, Authentik credentials; vault under private home; shared files at `/shared`
- [ ] Optional migrate former Nextcloud files: `nextcloud/volumes/html/data/<user>/files/` → `storage/users/<user>/`, then remove leftover `nextcloud/volumes/`
- [ ] Docs: [Samba](https://www.samba.org/) · [SFTPGo](https://docs.sftpgo.com/) · [Authentik LDAP](https://docs.goauthentik.io/add-secure-apps/providers/ldap/)

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
