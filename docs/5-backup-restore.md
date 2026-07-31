## Backup and Restore (Restic + Service hooks)

Homelab state lives in gitignored bind mounts (`volumes/`, `services/*/volumes/`, `storage/`) plus `.env`. Cloud backups use **Restic** to an S3-compatible bucket (Backblaze B2). Per-service logic is implemented on the `Service` base class (`setup` / `postsetup` / `backup` / `restore`) and driven by root [`setup.py`](../setup.py).

### Architecture

| Layer | Role |
| --- | --- |
| Git | Compose stacks, scripts, `services/*/setup.py` |
| Bind mounts | Secrets, certs, databases, app data under `volumes/`, `*/volumes/`, and NAS homes under `storage/` |
| `Service.backup()` | Consistent dumps (Postgres `pg_dump`, SQLite `.backup`) before upload |
| Restic → B2 | Encrypted offsite snapshots of `.env`, `volumes/`, `*/volumes/`, `storage/` |
| `Service.restore()` | Apply dumps into live DBs after a cloud restore |

Compose services use host bind mounts (not Docker named volumes). Directory ownership is created in each service’s `setup()`.

### One-time cloud repository setup

1. Create a private B2 (or other S3) bucket and an application key with read/write access.
2. Install [restic](https://restic.net/) on the host (`pacman -S restic`).
3. Run `python3 setup.py setup` and answer **y** when prompted to configure cloud backup. [`restic/setup.py`](../services/restic/setup.py) will:
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

Re-execs under `sudo` automatically (same as the nightly timer’s `User=root`). Postgres dumps are written mode `0600` under `*/volumes/db-dumps/`. You may be prompted for your sudo password.

Flow: load env/secrets → each `Service.backup()` → `restic backup` of `.env`, `volumes/`, `*/volumes/`, `storage/` → retention `forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune`.

### Automated backups (systemd)

[`homelab-backup.timer`](../systemd/system/homelab-backup.timer) runs daily at **03:00 host local** and executes:

```shell
python3 setup.py backup --auto
```

That is ahead of Nextcloud’s maintenance window (04:00–08:00 local). Full schedule table: [3. Project Deployment — Scheduled jobs](./3-deployment.md#scheduled-jobs-host-local-time).

Setup installs and enables the timer. To reinstall units after editing templates under [`systemd/system/`](../systemd/system/), re-run `python3 setup.py setup`, or:

```shell
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-backup.timer
sudo journalctl -u homelab-backup.service
```

### Restore / disaster recovery

⚠️ Overwrites local `.env` and volume trees from the snapshot.

1. Clone the Git repo onto the machine.
2. Run:

```shell
python3 setup.py restore          # latest
# or
python3 setup.py restore <snapshot-id>
```

If `volumes/secrets/restic_*` are missing, restore (and interactive backup) will prompt for repository URL, encryption password, and S3 keys, then write them under `volumes/secrets/`. Automated `backup --auto` will not prompt.

Flow: `restic restore` → `Service.setup()` (permissions) → `docker compose up -d` → `Service.restore()` (apply DB dumps / SQLite snapshots) → wait for healthy containers.

3. If needed, re-run full install postsetups: `python3 setup.py setup` (idempotent for most hooks).

### What gets special snapshot hooks

| Service | Hook |
| --- | --- |
| Authentik, Nextcloud, Immich | `pg_dump` → `*/volumes/db-dumps/`; live `*/volumes/db/` excluded from Restic |
| Vaultwarden, Dashboard, Gotify | SQLite online `.backup` into the service bind mount |
| Samba data | `storage/users/` (private) + `storage/shared/` (included as `storage/` target) |
| ddclient | Config at `ddclient/volumes/ddclient.conf` (included via `*/volumes/`) |

`.backup_exclude` skips `ollama/volumes/ollama/` and `immich/volumes/model-cache/` (regenerable) until/unless S3 capacity grows.

Pi-hole, Dockhand, RustDesk id/relay, word-games data are still uploaded as ordinary files (no freeze hook).

### Service lifecycle (developers)

Each `services/*/setup.py` exports `service = SomeService()` subclassing [`setup.service.Service`](../setup/service.py):

- `setup(env)` — before containers (volume mkdir/chown, secrets prep)
- `postsetup(env)` — after containers healthy (OIDC, theming, …)
- `backup(env)` — before Restic upload
- `restore(env)` — after cloud restore + compose up

Registry: [`setup/registry.py`](../setup/registry.py).


## Next: 6. Development

[Continue to the next section of the guide for detailed instructions on development tasks and contributing to the project.](./6-development.md)
