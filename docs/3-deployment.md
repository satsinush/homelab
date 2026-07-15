## 🚀 Project Deployment

Once the host is configured, follow these steps to deploy the services.

### 1\. 📝 Configure Environment

1.  **Dynamic DNS**
      * If you use a DDNS service, run setup (seeds [`./ddclient/volumes/ddclient.conf`](../ddclient/volumes/ddclient.conf) from [`./ddclient/example.ddclient.conf`](../ddclient/example.ddclient.conf)) and fill in your provider's details. That path is under `*/volumes/` so Restic backs it up.
      * [ddclient Docs 🔗](https://ddclient.net/)
2.  **Environment Variables**
      * The `setup.sh` script will use `./.env.template` as a base to generate your final `.env` file. Carefully change any values you want to customize in the template **before** running the script.
      * Values in `<angle_brackets>` will be replaced automatically by the setup script.

### 2\. ⚙️ Systemd host services

[`setup.py`](../setup.py) installs and enables these automatically:

* `homelab-host-api.service` — dashboard Host API (`dashboard/host-api`, after `npm install`)
* `homelab-backup.timer` — daily Restic backup via `setup.py backup --auto`
* `pacman-sync.timer` — daily `pacman -Sy` (Arch hosts only)
* `docker.socket` / `docker.service`
* `systemd-timesyncd`

Unit templates live in [`systemd/system/`](../systemd/system/) and use `${PROJECT_ROOT}`, `${PUID}`, `${PGID}` (from `.env`) plus `${NODE}` / `${PYTHON}` (detected at install). Setup expands them with the same `substitute_env_vars` helper used for `.env.template`, installs under `/etc/systemd/system/`, and adds your user to the `docker` group when needed (re-entering the group for the same setup run). You get a y/n prompt first so you can skip this on a non-server / dev machine.

If the clock is not synchronized, copy or adapt [`systemd/timesyncd.conf`](../systemd/timesyncd.conf) and run `sudo systemctl restart systemd-timesyncd`. See the [systemd wiki](https://wiki.archlinux.org/title/Systemd#Basic_systemctl_usage).

### 3\. ⚡ Run the Setup Script

Execute the main setup script. It will prompt you to create a username and password, configure systemd, and initialize all services.

```shell
./setup.sh
```

> **⚠️ Important**: The setup script creates a user-specific email address. You **must** use this email for services like Vaultwarden to receive password-reset and similar mail. The Apprise SMTP gateway routes those messages to Gotify.

> **ℹ️ Tip**: You can run this script again at any time to recreate SSL certificates. The CA certificate will not be affected and all other settings will stay the same.

### SSL Modes

`setup.sh` supports two SSL modes that are selected interactively during the first run:

| Mode | When to use | How it works |
|------|-------------|--------------|
| **Private (default)** | No public domain | OpenSSL generates a local CA and a wildcard server certificate. Import the CA cert once per client device. |
| **Public (Let's Encrypt)** | You own a domain managed by Cloudflare | Traefik uses the ACME DNS-01 challenge to obtain a globally-trusted certificate — no open ports required. Setup still generates a local CA for internal trust mounts, but Traefik’s default TLS cert is **localhost-only** so it cannot shadow Let’s Encrypt for your real hostname. |

#### Getting a Cloudflare DNS API Token (Public mode)

The recommended way to use Let's Encrypt with Traefik is via the DNS-01 challenge, which requires an API token from your DNS provider. This is a secure way that doesn't require port forwarding. If you use Cloudflare for your domain's DNS, follow these steps to create a suitable API token:

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Go to **My Profile → API Tokens → Create Token**.
3. Use the **Edit zone DNS** template (or create a custom token with the `Zone → DNS → Edit` permission scoped to your specific zone).
4. Copy the token and provide it when `setup.sh` asks `Do you have a public domain with Cloudflare DNS? (y/n)`.

#### ACME Email Address (Public mode)

Let's Encrypt requires a valid email address to send certificate expiry warnings. `setup.sh` will prompt you for this address and validates its format.

**Option A — Use your regular email** (simplest): just type your personal address when prompted.

**Option B — Use `<username>@<your-domain>` with Cloudflare Email Routing** (keeps your real inbox private):

Cloudflare's free [Email Routing](https://developers.cloudflare.com/email-routing/) service can forward any address at your domain to your real inbox with no mail server required.

1. In the Cloudflare Dashboard, select your zone and go to **Email → Email Routing**.
2. Click **Enable Email Routing** and follow the wizard to add the required MX / TXT DNS records.
3. Under **Custom addresses**, click **Create address**:
   - **Custom address:** `<your-username>` (e.g. `alice`)
   - **Destination:** your real email address
4. When `setup.sh` prompts for the ACME email, enter `<username>@<your-domain>` (e.g. `alice@example.com`).

Cloudflare will forward any Let's Encrypt notifications sent to that address to your real inbox automatically.

## Next: 4\. ✅ Post-Installation Checklist
[Continue to the next section of the guide for detailed instructions on post-installation tasks and final checks.](./4-checklist.md)