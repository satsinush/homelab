## 🚀 Project Deployment

Once the host is configured, follow these steps to deploy the services.

### 1\. 📝 Configure Environment

1.  **Dynamic DNS**
      * If you use a DDNS service, make sure to copy [`./ddclient/example.ddclient.conf`](../ddclient/example.ddclient.conf) to `./ddclient/ddclient.conf` and fill in your provider's details.
      * [ddclient Docs 🔗](https://ddclient.net/)
2.  **Environment Variables**
      * The `setup.sh` script will use `./.env.template` as a base to generate your final `.env` file. Carefully change any values you want to customize in the template **before** running the script.
      * Values in `<angle_brackets>` will be replaced automatically by the setup script.

### 2\. ⚙️ Enable Systemd Services

To complete the server setup, you'll need to configure and enable a few custom `systemd` services. These manage the host API, automatic package updates, and automated backups.

#### **Step 1: Copy the Files to Systemd**

Copy the systemd service files to the system directory with this command.

```shell
sudo cp -rv ./systemd/system/* /etc/systemd/system/
```

#### **Step 2: Configure the Service Files**

After copying the files, you must edit them to match your user and home directory.

1.  Open `/etc/systemd/system/homelab-host-api.service`.
2.  Open `/etc/systemd/system/homelab-backup.service`.

In both files, find and replace the usernames and file paths with the correct values.

Replace these lines:
```
WorkingDirectory=/home/USERNAME/homelab
ExecStart=/home/USERNAME/homelab/backup.sh backup --auto

User=USERNAME
Group=USERNAME
WorkingDirectory=/home/USERNAME/homelab/homelab-dashboard/host-api
```

#### **Step 3: Reload Daemon and Enable Services**

First, tell `systemd` to re-read its configuration to detect the new files.

```shell
sudo systemctl daemon-reload
```

Next, enable and start the new services and timers. The `enable --now` command starts them immediately and also ensures they launch automatically on boot.

```shell
# Custom Services
sudo systemctl enable --now homelab-host-api.service
sudo systemctl enable --now pacman-sync.timer
sudo systemctl enable --now homelab-backup.timer

# You can verify the services are running with
sudo systemctl status homelab-host-api.service
sudo systemctl status pacman-sync.timer
sudo systemctl status homelab-backup.timer
```

Finally, ensure the system's time synchronization service is active, as accurate time is crucial for many services.

```shell
# Enable and start the time sync service
sudo systemctl enable --now systemd-timesyncd

# Check the status
timedatectl status
```

> **ℹ️ Note**: If **`System clock synchronized`** shows **`no`**, you may need to edit `/etc/systemd/timesyncd.conf` to configure a reliable time source. Check [`./systemd/timesyncd.conf`](../systemd/timesyncd.conf) for an example. After editing, restart the service with `sudo systemctl restart systemd-timesyncd`.

-----

  * [Systemd Docs 🔗](https://wiki.archlinux.org/title/Systemd#Basic_systemctl_usage)

### 3\. ⚡ Run the Setup Script

Execute the main setup script. It will prompt you to create a username and password and automatically configure and initialize all the services.

```shell
./setup.sh
```

> **⚠️ Important**: The setup script creates a user-specific email address. You **must** use this email for services like Vaultwarden and Authelia to receive notifications via Ntfy, otherwise you risk not being able to reset your password if needed. Your notification topic in Ntfy is `HOMELAB_USERNAME` which can be found in the `.env` file.

> **ℹ️ Tip**: You can run this script again at any time to recreate SSL certificates. The CA certificate will not be affected and all other settings will stay the same.

### SSL Modes

`setup.sh` supports two SSL modes that are selected interactively during the first run:

| Mode | When to use | How it works |
|------|-------------|--------------|
| **Private (default)** | No public domain | OpenSSL generates a local CA and a wildcard server certificate. Import the CA cert once per client device. |
| **Public (Let's Encrypt)** | You own a domain managed by Cloudflare | Traefik uses the ACME DNS-01 challenge to obtain a globally-trusted certificate — no open ports required. |

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