import database from './Database';
import type Database from 'better-sqlite3';

export interface PackageNotifyRow {
    name: string;
    notifiedVersion: string;
    lastNotifiedAt: number;
}

class PackageUpdateNotifications {
    private db: Database.Database;

    constructor() {
        this.db = database.getDatabase();
    }

    list(): PackageNotifyRow[] {
        const rows = this.db
            .prepare(
                'SELECT name, notified_version AS notifiedVersion, last_notified_at AS lastNotifiedAt FROM package_update_notifications'
            )
            .all() as Array<{ name: string; notifiedVersion: string; lastNotifiedAt: number }>;
        return rows.map(r => ({
            name: r.name,
            notifiedVersion: r.notifiedVersion,
            lastNotifiedAt: r.lastNotifiedAt,
        }));
    }

    getMap(): Map<string, PackageNotifyRow> {
        return new Map(this.list().map(r => [r.name, r]));
    }

    upsert(name: string, notifiedVersion: string, lastNotifiedAt: number): void {
        this.db
            .prepare(
                `INSERT INTO package_update_notifications (name, notified_version, last_notified_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(name) DO UPDATE SET
                   notified_version = excluded.notified_version,
                   last_notified_at = excluded.last_notified_at`
            )
            .run(name, notifiedVersion, lastNotifiedAt);
    }

    upsertMany(
        rows: Array<{ name: string; notifiedVersion: string; lastNotifiedAt: number }>
    ): void {
        const stmt = this.db.prepare(
            `INSERT INTO package_update_notifications (name, notified_version, last_notified_at)
             VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
               notified_version = excluded.notified_version,
               last_notified_at = excluded.last_notified_at`
        );
        const tx = this.db.transaction(
            (items: Array<{ name: string; notifiedVersion: string; lastNotifiedAt: number }>) => {
                for (const row of items) {
                    stmt.run(row.name, row.notifiedVersion, row.lastNotifiedAt);
                }
            }
        );
        tx(rows);
    }

    /** Keep only packages still pending; delete applied ones. */
    syncPending(pendingNames: Set<string>): void {
        const existing = this.list();
        const del = this.db.prepare('DELETE FROM package_update_notifications WHERE name = ?');
        const tx = this.db.transaction((rows: PackageNotifyRow[]) => {
            for (const row of rows) {
                if (!pendingNames.has(row.name)) {
                    del.run(row.name);
                }
            }
        });
        tx(existing);
    }

    clear(): void {
        this.db.prepare('DELETE FROM package_update_notifications').run();
    }
}

export default PackageUpdateNotifications;
