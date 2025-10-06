## 🚀 Project Deployment

Once the host is configured, follow these steps to deploy the services.

### 1\. 📝 Configure Environment

1.  **Dynamic DNS**
      * If you use a DDNS service, make sure to copy [`./ddclient/example.ddclient.conf`](./ddclient/example.ddclient.conf) to `./ddclient/ddclient.conf` and fill in your provider's details.
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

> **ℹ️ Note**: If **`System clock synchronized`** shows **`no`**, you may need to edit `/etc/systemd/timesyncd.conf` to configure a reliable time source. Check [`./systemd/timesyncd.conf`](./systemd/timesyncd.conf) for an example. After editing, restart the service with `sudo systemctl restart systemd-timesyncd`.

-----

  * [Systemd Docs 🔗](https://wiki.archlinux.org/title/Systemd#Basic_systemctl_usage)

### 3\. ⚡ Run the Setup Script

Execute the main setup script. It will prompt you to create a username and password and automatically configure and initialize all the services.

```shell
./setup.sh
```

> **⚠️ Important**: The setup script creates a user-specific email address. You **must** use this email for services like Vaultwarden and Authelia to receive notifications via Ntfy, otherwise you risk not being able to reset your password if needed. Your notification topic in Ntfy is `YOUR USERNAME`.

> **ℹ️ Tip**: You can run this script again at any time to recreate SSL certificates. The CA certificate will not be affected and all other settings will stay the same.