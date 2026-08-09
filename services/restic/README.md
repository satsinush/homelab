# 💾 Restic Backup Service

Restic handles offsite cloud backups and disaster recovery snapshotting.

* **Official Documentation:** [restic.readthedocs.io](https://restic.readthedocs.io/)

---

## Overview

Restic creates encrypted, deduplicated offsite backups to S3-compatible cloud storage (such as Cloudflare R2 or Backblaze B2).

## Architecture & Integration

* **Host Integration:** Invoked directly on host machine via `python3 setup.py backup`.
* **Automated Systemd Unit:** `systemd/system/homelab-backup.timer` triggers `homelab-backup.service` daily at **03:00 local time**.
* **Database Hooks:** Calls custom pre-backup hooks (`Service.backup()`) to perform clean database dumps (Postgres `pg_dump` and SQLite `.backup`).

## Backup Execution & Schedule

* **Automated Timer:** `homelab-backup.timer` runs daily at **03:00 local time**.
* **Execution Command:** `python3 setup.py backup --auto`

## Verification & Manual Operations

```bash
# Perform manual backup
python3 setup.py backup

# Check status of daily backup timer
systemctl status homelab-backup.timer

# View backup service logs
journalctl -u homelab-backup.service --tail 50
```
