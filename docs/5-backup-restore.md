## 💾 Backup and Restore

This project includes a powerful script, [`backup.sh`](./backup.sh), for both manual and automated backups. It archives all essential data—including local configurations, bind mounts (`./volumes`), and Docker named volumes—into a single, compressed `.tar.gz` file.

### Creating a Backup

The script supports two ways to create backups.

#### **Manual Backups**

To run a one-off manual backup at any time, use the `backup` command. This will temporarily stop your services, create a single timestamped archive in the `./backups` directory, and then restart everything.

```shell
sudo ./backup.sh backup
```

This will create a file like `./backups/homelab-backup-2025-08-20_19-05-00.tar.gz`.

### Automated Backups (Systemd Timer) 🗓️

This project uses a `systemd` timer for robust, automated backups. The `homelab-backup.timer` unit, which you enabled during setup, handles this process automatically.

By default, the timer is configured to:

  * Run the backup script with the `--auto` flag **daily at 3:00 AM**.
  * Store the archives in the `./backups/auto/` subdirectory.
  * Keep only the **last 7 backups**, deleting older ones automatically.

#### **Checking the Backup Timer Status**

You can check the status of all timers, including when the next backup is scheduled to run, with the following command:

```shell
systemctl list-timers
```

#### **Viewing Backup Logs**

To see the output from the last time the backup service ran, use `journalctl`:

```shell
sudo journalctl -u homelab-backup.service
```

#### **Changing the Schedule**

To change the backup frequency, edit the `OnCalendar=` line in `/etc/systemd/system/homelab-backup.timer` and then reload the systemd daemon with `sudo systemctl daemon-reload`.

-----

### Restoring from a Backup

⚠️ **Warning:** The restore process is destructive and will overwrite your current data.

For a completely clean restore, follow these steps:

1.  **Full Teardown (Optional):** Completely remove the old stack and all its volumes to prevent any conflicts with old data.
    ```shell
    docker compose down -v
    ```
2.  **Run the Restore Script**: Use the `restore` command, providing the path to the `.tar.gz` archive you want to restore from. The script will handle the rest of the process.
    ```shell
    # Replace with the path to your actual backup archive
    sudo ./backup.sh restore ./backups/auto/homelab-backup-2025-08-20_19-05-00.tar.gz
    ```

-----

### Important Notes

  * The `./backups` directory should be added to your `.gitignore` file.
  * For true disaster recovery, you should regularly copy your backups to an off-site location (e.g., cloud storage, a separate NAS, or an external drive).