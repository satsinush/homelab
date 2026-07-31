## 🚀 Project Deployment

Once the host is configured, follow these steps to deploy the services.

### 1\. 📝 Configure Environment

1.  **Dynamic DNS**
      * If you use Cloudflare DDNS, create an API token ([below](#cloudflare-account-api-tokens-new-dashboard)), then after setup edit [`./services/ddclient/volumes/ddclient.conf`](../services/ddclient/volumes/ddclient.conf) (seeded from [`./services/ddclient/example.ddclient.conf`](../services/ddclient/example.ddclient.conf)). That path is under `*/volumes/` so Restic backs it up.
      * [ddclient Docs 🔗](https://ddclient.net/)
2.  **Environment Variables**
      * Defaults and managed keys live in [`setup/env_schema.py`](../setup/env_schema.py). On first run, `setup.py` prompts for hostname, subnets, etc., and writes `.env`. Later runs sync missing keys into the existing `.env` without clobbering your values.
      * Edit `.env` directly for day-to-day changes (or re-run setup after updating the schema defaults).

### 2\. ⚙️ Systemd host services

[`setup.py`](../setup.py) installs and enables these automatically:

* `homelab-host-api.service` — dashboard Host API (`services/dashboard/host-api`, after `npm install`)
* `homelab-backup.timer` — daily Restic backup via `setup.py backup --auto` (03:00 host local)
* `pacman-sync.timer` — `pacman -Sy` every 6 hours at `:15` (Arch hosts only)
* `docker.socket` / `docker.service`
* `systemd-timesyncd`

#### Scheduled jobs (host local time)

Times use the **host timezone** (`timedatectl`). Systemd `OnCalendar` is local unless the unit sets a different timezone.

| When (local) | What | Where |
| --- | --- | --- |
| **03:00** daily | Restic cloud backup (`setup.py backup --auto`) | `homelab-backup.timer` |
| **00/06/12/18:15** (+ up to 5 min jitter) | Pacman DB sync (`pacman -Sy`) | `pacman-sync.timer` |
| **00/06/12/18:30** | Dashboard package-update check + Gotify alerts | Dashboard API (`packageUpdateChecker`) |
| **04:00–08:00** | Nextcloud heavy daily jobs (4-hour maintenance window) | Set in Nextcloud postsetup from host TZ (`maintenance_window_start`) |
| ~every **5 min** | Nextcloud ordinary cron (`nextcloud-cron`) | `services/nextcloud/compose.yaml` |
| every **5 min** | ddclient DDNS (if configured) | `ddclient` / `daemon=300` |

Overnight order is intentional: **backup at 03:00**, then Nextcloud’s expensive window **after** that (04:00–08:00 local) so they do not compete for disk.

Check timers:

```shell
systemctl list-timers homelab-backup.timer pacman-sync.timer --all
docker exec -u www-data nextcloud php occ config:system:get maintenance_window_start
```

Unit templates live in [`systemd/system/`](../systemd/system/) and use `${PROJECT_ROOT}`, `${PUID}`, `${PGID}` (from `.env`) plus `${PYTHON}` (detected at install). Setup expands them with `substitute_env_vars`, installs under `/etc/systemd/system/`, and adds your user to the `docker` group when needed (re-entering the group for the same setup run). You get a y/n prompt first so you can skip this on a non-server / dev machine. The host API unit runs `tsx server.ts` from `services/dashboard/host-api` after `npm install`.

If the clock is not synchronized, copy or adapt [`systemd/timesyncd.conf`](../systemd/timesyncd.conf) and run `sudo systemctl restart systemd-timesyncd`. See the [systemd wiki](https://wiki.archlinux.org/title/Systemd#Basic_systemctl_usage).

### 3\. ⚡ Run the Setup Script

Execute the main setup script. It will prompt you to create a username and password, configure systemd, and initialize all services.

```shell
./setup.py
```

> **⚠️ Important**: The setup script creates a user-specific email address. You **must** use this email for services like Vaultwarden to receive password-reset and similar mail. The alerts SMTP gateway routes those messages to Gotify.

> **ℹ️ Tip**: You can run this script again at any time to recreate SSL certificates. The CA certificate will not be affected and all other settings will stay the same.

### SSL Modes

Setup supports two SSL modes that are selected interactively during the first run:

| Mode | When to use | How it works |
|------|-------------|--------------|
| **Private (default)** | No public domain | OpenSSL generates a local CA and a wildcard server certificate. Import the CA cert once per client device. Traefik + Stalwart (IMAPS/SMTPS) both use this cert. |
| **Public (Let's Encrypt)** | You own a domain managed by Cloudflare | Traefik uses ACME DNS-01 for HTTPS. `traefik-certs-dumper` watches `acme.json`, writes PEMs to `volumes/certificates/stalwart-tls/`, and tells Stalwart to reload TLS (mail ports bypass Traefik). Renewals do not require re-running setup. A local CA is still minted for internal container trust mounts. |

### Cloudflare credentials

Cloudflare is used in three places (not all required):

| Use | Credential type | Where it goes |
| --- | --- | --- |
| Traefik Let's Encrypt (DNS-01) | Account API token | `volumes/secrets/cf_dns_api_token` (setup prompts in public mode) |
| ddclient DDNS | Account API token (same scopes; separate token recommended) | `ddclient/volumes/ddclient.conf` (`password=…`, `login=token`) |
| Restic offsite backup on R2 | **R2** API token (S3 keys) — not an Account API token | `volumes/secrets/restic_*` (setup prompts when enabling backup) |

#### Cloudflare Account API tokens (new dashboard)

Presets may be missing. Create a **custom** token:

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Open **Manage Account** (account home) → **Account API tokens** → **Create Token**.  
   (Older UI: profile icon → **My Profile** → **API Tokens**.)
3. Choose **Create Custom Token** (not a template).
4. **Token name:** e.g. `Homelab Traefik DNS` or `Homelab ddclient`.
5. Under **Permissions**, add rows from **Permissions → DNS & Zones**:

   | Permission | Access |
   | --- | --- |
   | **Zone** → **DNS** | **Edit** (Read may be checked as well) |
   | **Zone** → **Zone** | **Read** |

6. Under **Zone Resources** (or **Permission Policy Scope**):
   - Prefer **Include → Specific zone → `your-domain.com`** (least privilege), **or**
   - **Include → All zones** if a tool requires it (ddclient’s Cloudflare docs historically asked for all zones with API tokens).
7. Leave Client IP / TTL filters empty unless you know you need them.
8. **Continue to summary → Create Token**, then copy the value **once**.

Store tokens only in secret files / `ddclient.conf` (never commit them). Prefer **one token per use** (Traefik vs ddclient) so you can revoke without breaking both.

##### Traefik (public SSL mode)

Paste the token when setup asks for the Cloudflare DNS API token, or write it yourself (no trailing newline):

```shell
printf '%s' 'YOUR_TOKEN' > volumes/secrets/cf_dns_api_token
chmod 600 volumes/secrets/cf_dns_api_token
```

Then recreate Traefik if it was already running: `docker compose up -d --force-recreate traefik`.

##### ddclient

After setup seeds [`ddclient/volumes/ddclient.conf`](../services/ddclient/volumes/ddclient.conf), use the Cloudflare block (see the example file) with:

```text
protocol=cloudflare
zone=your-domain.com
ttl=1
login=token
password=YOUR_API_TOKEN
your-hostname.your-domain.com
```

`login` must be the literal string `token` when using an API token (not your email). Recreate after edits: `docker compose up -d --force-recreate ddclient`.

#### Cloudflare R2 for Restic (optional)

Restic uses **S3-compatible** credentials. For Cloudflare R2 these come from **R2**, not Account API Tokens:

1. Dashboard → **R2 Object Storage** → create a bucket.
2. **Manage R2 API Tokens** → **Create Account API token** (R2 section).
3. Permissions: **Object Read & Write** (and create-bucket only if you need it) scoped to that bucket if possible.
4. Copy **Access Key ID** and **Secret Access Key**.
5. Repository URL shape: `s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>`
6. During setup/backup prompts (or write `volumes/secrets/restic_*` yourself): repository URL, encryption password, access key id, secret key.

Backblaze B2 works the same way with B2’s S3 endpoint and application keys — see [5. Backup and Restore](./5-backup-restore.md).

#### ACME email (public SSL mode)

Let's Encrypt requires a valid email for expiry notices. Setup prompts and validates the format.

**Option A — Regular email** (simplest): enter your personal address.

**Option B — `<username>@<your-domain>` with Cloudflare Email Routing**:

1. Zone → **Email** → **Email Routing** → enable and finish MX/TXT setup.
2. **Custom addresses** → create e.g. `alice` → forward to your real inbox.
3. When setup asks for ACME email, enter `alice@your-domain.com`.

## Next: 4\. ✅ Post-Installation Checklist
[Continue to the next section of the guide for detailed instructions on post-installation tasks and final checks.](./4-checklist.md)
