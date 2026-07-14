## Backup and Restore (Restic + Service hooks)

Homelab state lives in gitignored bind mounts (`volumes/` and `*/volumes/`) plus `.env`. Cloud backups use **Restic** to an S3-compatible bucket (Backblaze B2). Per-service logic is implemented on the `Service` base class (`setup` / `postsetup` / `backup` / `restore`) and driven by root [`setup.py`](../setup.py).

### Architecture

| Layer | Role |
| --- | --- |
| Git | Compose stacks, scripts, `*/setup.py` services |
| Bind mounts | Secrets, certs, databases, app data under `volumes/` and `*/volumes/` |
| `Service.backup()` | Consistent dumps (Postgres `pg_dump`, SQLite `.backup`) before upload |
| Restic → B2 | Encrypted offsite snapshots of `.env`, `volumes/`, `*/volumes/` |
| `Service.restore()` | Apply dumps into live DBs after a cloud restore |

Compose services use host bind mounts (not Docker named volumes). Directory ownership is created in each service’s `setup()`.

### One-time cloud repository setup

1. Create a private B2 (or other S3) bucket and an application key with read/write access.
2. Install [restic](https://restic.net/) on the host (`pacman -S restic`).
3. Run `python3 setup.py setup` and answer **y** when prompted to configure cloud backup. [`restic/setup.py`](../restic/setup.py) will:
   - Ask for repository URL, encryption password, and S3 access key / secret
   - Write `volumes/secrets/restic_*` (mode `0600`)
   - Copy [`.backup_exclude.example`](../.backup_exclude.example) → `.backup_exclude` if needed
   - Run `restic init` when the binary is available
4. Re-run setup later if you skipped the prompt; existing secrets are left alone.

**Do not** put Restic credentials in `.env` — only under `volumes/secrets/`.

### Manual backup

```shell
python3 setup.py backup
```

Flow: load env/secrets → each `Service.backup()` → `restic backup` of `.env`, `volumes/`, `*/volumes/` → retention `forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune`.

### Automated backups (systemd)

[`homelab-backup.timer`](../systemd/system/homelab-backup.timer) runs daily at 03:00 and executes:

```shell
python3 setup.py backup --auto
```

After updating the unit files under `/etc/systemd/system/`:

```shell
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-backup.timer
systemctl list-timers
sudo journalctl -u homelab-backup.service
```

### Restore / disaster recovery

⚠️ Overwrites local `.env` and volume trees from the snapshot.

1. Clone the Git repo onto the machine.
2. Restore secrets needed for Restic (or restore files first onto a machine that already has B2 credentials).
3. Run:

```shell
python3 setup.py restore          # latest
# or
python3 setup.py restore <snapshot-id>
```

Flow: `restic restore` → `Service.setup()` (permissions) → `docker compose up -d` → `Service.restore()` (apply DB dumps / SQLite snapshots).

4. If needed, re-run full install postsetups: `python3 setup.py setup` (idempotent for most hooks).

### What gets special snapshot hooks

| Service | Hook |
| --- | --- |
| Authentik / Nextcloud | `pg_dump` → `*/volumes/db-dumps/`; live `*/volumes/db/` excluded from Restic |
| Vaultwarden, Dashboard, Gotify, RustDesk console | SQLite online `.backup` into the service bind mount |

Pi-hole, Dockhand, RustDesk id/relay, word-games data are still uploaded as ordinary files (no freeze hook).

### Service lifecycle (developers)

Each `*/setup.py` exports `service = SomeService()` subclassing [`service.Service`](../service.py):

- `setup(env)` — before containers (volume mkdir/chown, secrets prep)
- `postsetup(env)` — after containers healthy (OIDC, theming, …)
- `backup(env)` — before Restic upload
- `restore(env)` — after cloud restore + compose up

Registry: [`services_registry.py`](../services_registry.py).


## Next: 6. Development

[Continue to the next section of the guide for detailed instructions on development tasks and contributing to the project.](./6-development.md)
