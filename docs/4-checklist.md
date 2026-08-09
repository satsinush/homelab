## ✅ Post-Installation Verification Checklist

Complete this checklist immediately after running [`./setup.py`](../setup.py) to ensure all containers, certificates, and authentication integrations are fully operational.

For detailed setup instructions, architecture details, and commands for individual components, refer to the [Services Index](./8-services.md).

---

### 1. 🌐 Core Edge & DNS Infrastructure

- [ ] **DNS Resolution ([Pi-hole](../services/pihole/README.md) + [Unbound](../services/unbound/README.md))**
  - Point clients to the homelab IP (`HOMELAB_IP_ADDRESS`).
  - Test recursive lookup: `dig @<HOMELAB_IP> example.com`
  - Admin UI: `https://dns.<your-hostname>/admin` (Password in `volumes/secrets/pihole_admin_password`).

- [ ] **Reverse Proxy ([Traefik](../services/traefik/README.md))**
  - Confirm Traefik container is running: `docker compose ps traefik`
  - Verify HTTPS certificate validity in browser or via curl.

- [ ] **Private SSL Mode Only ([CA Certificate](../services/traefik/README.md))**
  - Copy `./volumes/certificates/homelab-ca.crt` to client devices.
  - Install cert into trusted root authorities on Windows, macOS, Linux, Android, and iOS.

---

### 2. 🔑 Identity & Access Management

- [ ] **Single Sign-On ([Authentik](../services/authentik/README.md))**
  - Open `https://auth.<your-hostname>`
  - Verify admin login (User `akadmin`, password in `volumes/secrets/authentik_admin_password`).
  - Confirm LDAP outpost container is healthy: `docker compose ps authentik-ldap`

- [ ] **VPN Control Plane ([Headscale](../services/headscale/README.md))**
  - Open `https://vpn.<your-hostname>` and verify Authentik enrollment flow.
  - Test remote client connection via Tailscale app.
  - Disable node key expiration for personal devices:
    ```bash
    docker exec -it headscale headscale nodes expire --identifier <NODE_ID> --disable
    ```

---

### 3. 💾 Storage, Files & Productivity

- [ ] **Files & Groupware ([Nextcloud](../services/nextcloud/README.md))**
  - Open `https://cloud.<your-hostname>` and log in via Authentik.
  - Test document editing via Collabora Office (`https://office.<your-hostname>`).
  - Break-glass admin login: `https://cloud.<your-hostname>/login?direct=1` (Password in `volumes/secrets/nextcloud_admin_password`).

- [ ] **Photos ([Immich](../services/immich/README.md))**
  - Open `https://photos.<your-hostname>` and log in via Authentik.
  - Test uploading a photo/video.
  - Connect mobile app to `https://photos.<your-hostname>`.

- [ ] **Passwords ([Vaultwarden](../services/vaultwarden/README.md))**
  - Open `https://vault.<your-hostname>` and test sign-in with your homelab email.
  - Confirm password reset email delivery via internal alerts gateway.

- [ ] **LAN SMB Sharing ([Samba](../services/samba/README.md))**
  - Ensure user belongs to `homelab-admins` group in Authentik.
  - Connect to `\\<HOMELAB_IP>\<username>` and `\\<HOMELAB_IP>\shared`.

- [ ] **Mail ([Stalwart](../services/stalwart/README.md))**
  - Open Nextcloud Mail (`https://cloud.<your-hostname>/apps/mail/`).
  - Confirm sending/receiving messages on `mail.<your-hostname>`.

---

### 4. 📊 Monitoring, Management & Operations

- [ ] **Health Status ([Gatus](../services/gatus/README.md))**
  - Open `https://status.<your-hostname>` (Public status page).
  - Verify all internal service checks report green.

- [ ] **Notifications ([Gotify](../services/gotify/README.md) & [Alerts](../services/alerts/README.md))**
  - Open `https://notify.<your-hostname>` and sign in as `alerts` (Password in `volumes/secrets/gotify_alerts_password`).
  - Install Gotify mobile app to receive real-time push alerts.

- [ ] **Container Management ([Dockhand](../services/dockhand/README.md))**
  - Open `https://docker.<your-hostname>` via Authentik (`homelab-admins`).
  - Confirm Docker stacks and container status are visible.

- [ ] **Host Control ([Dashboard](../services/dashboard/README.md))**
  - Open `https://dashboard.<your-hostname>`
  - Test LAN device scan, package updates, and AI Chatbot ([Ollama](../services/ollama/README.md)).

- [ ] **Backups ([Restic](../services/restic/README.md))**
  - Verify automated systemd timer status: `systemctl status homelab-backup.timer`
  - Perform test dry run: `python3 setup.py backup`

---

## Done!

Your homelab services are fully deployed and verified.

## Next Steps
- [View full Service Directory & Architecture Index](./8-services.md)
- [Backup and Restore Guide](./5-backup-restore.md)
- [Development Setup](./6-development.md)
- [Troubleshooting Guide](./7-troubleshooting.md)
