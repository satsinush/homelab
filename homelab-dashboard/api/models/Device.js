const database = require('./Database');

class Device {
    constructor() {
        this.db = database.getDatabase();
    }

    // ─── Per-user reads ────────────────────────────────────────────────────────

    // Get all saved device records for a user
    getAllForUser(userId) {
        try {
            const stmt = this.db.prepare(
                'SELECT * FROM user_devices WHERE user_id = ? ORDER BY is_favorite DESC, updated_at DESC'
            );
            return stmt.all(userId).map(row => this._rowToDevice(row));
        } catch (error) {
            console.error('Error getting devices for user:', error);
            return [];
        }
    }

    // Get only favorite devices for a user
    getFavoritesForUser(userId) {
        try {
            const stmt = this.db.prepare(
                'SELECT * FROM user_devices WHERE user_id = ? AND is_favorite = 1 ORDER BY updated_at DESC'
            );
            return stmt.all(userId).map(row => this._rowToDevice(row));
        } catch (error) {
            console.error('Error getting favorites for user:', error);
            return [];
        }
    }

    // Find a specific user's device record by MAC
    findByMacForUser(userId, mac) {
        try {
            const stmt = this.db.prepare(
                'SELECT * FROM user_devices WHERE user_id = ? AND mac = ?'
            );
            const row = stmt.get(userId, mac);
            return row ? this._rowToDevice(row) : null;
        } catch (error) {
            console.error('Error finding device by MAC for user:', error);
            return null;
        }
    }

    // Check if a MAC is saved (favorite) by a given user
    isFavoriteForUser(userId, mac) {
        try {
            const stmt = this.db.prepare(
                'SELECT 1 FROM user_devices WHERE user_id = ? AND mac = ? AND is_favorite = 1'
            );
            return !!stmt.get(userId, mac);
        } catch (error) {
            console.error('Error checking favorite status:', error);
            return false;
        }
    }

    // Check if ANY user has this MAC saved as a favorite
    isMacFavoritedByAnyone(mac) {
        try {
            const stmt = this.db.prepare(
                'SELECT 1 FROM user_devices WHERE mac = ? AND is_favorite = 1'
            );
            return !!stmt.get(mac);
        } catch (error) {
            console.error('Error checking if MAC is favorited by anyone:', error);
            return false;
        }
    }

    // ─── Per-user writes ───────────────────────────────────────────────────────

    // Upsert a device record for a user
    saveForUser(userId, deviceData) {
        try {
            const now = new Date().toISOString();
            const mac = deviceData.mac;
            if (!mac) throw new Error('MAC address is required');

            const existing = this.findByMacForUser(userId, mac);

            if (existing) {
                const stmt = this.db.prepare(`
                    UPDATE user_devices
                    SET name = ?, description = ?, rustdesk_id = ?, is_favorite = ?,
                        last_ip = ?, status = ?, last_seen = ?, updated_at = ?
                    WHERE user_id = ? AND mac = ?
                `);
                stmt.run(
                    deviceData.name ?? existing.name,
                    deviceData.description ?? existing.description,
                    deviceData.rustdeskId ?? existing.rustdeskId,
                    deviceData.isFavorite !== undefined ? (deviceData.isFavorite ? 1 : 0) : (existing.isFavorite ? 1 : 0),
                    deviceData.ip ?? deviceData.last_ip ?? existing.ip,
                    deviceData.status ?? existing.status,
                    deviceData.lastSeen ?? existing.lastSeen,
                    now,
                    userId, mac
                );
            } else {
                const stmt = this.db.prepare(`
                    INSERT INTO user_devices
                        (user_id, mac, name, description, rustdesk_id, is_favorite,
                         last_ip, status, last_seen, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                stmt.run(
                    userId, mac,
                    deviceData.name ?? null,
                    deviceData.description ?? null,
                    deviceData.rustdeskId ?? null,
                    deviceData.isFavorite !== undefined ? (deviceData.isFavorite ? 1 : 0) : 1,
                    deviceData.ip ?? null,
                    deviceData.status ?? 'offline',
                    deviceData.lastSeen ?? null,
                    now, now
                );
            }
            return mac;
        } catch (error) {
            console.error('Error saving device for user:', error);
            throw error;
        }
    }

    // Set is_favorite for a user's device row (add the row if it doesn't exist)
    setFavoriteForUser(userId, mac, isFavorite) {
        try {
            const now = new Date().toISOString();
            if (isFavorite) {
                // Insert-or-update with is_favorite=1
                const stmt = this.db.prepare(`
                    INSERT INTO user_devices (user_id, mac, is_favorite, created_at, updated_at)
                    VALUES (?, ?, 1, ?, ?)
                    ON CONFLICT(user_id, mac) DO UPDATE SET is_favorite = 1, updated_at = excluded.updated_at
                `);
                stmt.run(userId, mac, now, now);
            } else {
                // Only update if row exists; don't create an empty un-favorited row
                const stmt = this.db.prepare(`
                    UPDATE user_devices SET is_favorite = 0, updated_at = ?
                    WHERE user_id = ? AND mac = ?
                `);
                stmt.run(now, userId, mac);
            }
            return true;
        } catch (error) {
            console.error('Error setting favorite for user:', error);
            throw error;
        }
    }

    // Delete a specific user's device record
    deleteForUser(userId, mac) {
        try {
            const stmt = this.db.prepare(
                'DELETE FROM user_devices WHERE user_id = ? AND mac = ?'
            );
            const result = stmt.run(userId, mac);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting device for user:', error);
            throw error;
        }
    }

    // Delete all non-favorite rows for a user (called on cache clear)
    clearNonFavoritesForUser(userId) {
        try {
            const stmt = this.db.prepare(
                'DELETE FROM user_devices WHERE user_id = ? AND is_favorite = 0'
            );
            const result = stmt.run(userId);
            console.log(`Cleared ${result.changes} non-favorite devices for user ${userId}`);
            return result.changes;
        } catch (error) {
            console.error('Error clearing non-favorites for user:', error);
            throw error;
        }
    }

    // ─── Cross-user scan updates ───────────────────────────────────────────────

    // After a network scan, update last_ip / status / last_seen for every user
    // who has a saved record for this MAC. Returns number of rows updated.
    updateScanDataForMac(mac, ip, status, lastSeen) {
        try {
            const now = lastSeen || new Date().toISOString();
            const stmt = this.db.prepare(`
                UPDATE user_devices
                SET last_ip = ?, status = ?, last_seen = ?, updated_at = ?
                WHERE mac = ?
            `);
            const result = stmt.run(ip, status, now, now, mac);
            return result.changes;
        } catch (error) {
            console.error('Error updating scan data for MAC:', error);
            return 0;
        }
    }

    // Mark all user_devices for a list of MACs as offline (MACs not found in scan)
    markOfflineByMacs(macs) {
        if (!macs || macs.length === 0) return;
        try {
            const now = new Date().toISOString();
            const placeholders = macs.map(() => '?').join(', ');
            const stmt = this.db.prepare(`
                UPDATE user_devices
                SET status = 'offline', updated_at = ?
                WHERE mac IN (${placeholders})
            `);
            stmt.run(now, ...macs);
        } catch (error) {
            console.error('Error marking devices offline:', error);
        }
    }

    // Get all unique MACs that are saved by at least one user (for scan merging)
    getAllSavedMacs() {
        try {
            const stmt = this.db.prepare('SELECT DISTINCT mac FROM user_devices');
            return stmt.all().map(r => r.mac);
        } catch (error) {
            console.error('Error getting all saved MACs:', error);
            return [];
        }
    }

    // Get all user_devices rows for a given MAC (across all users)
    getAllRowsForMac(mac) {
        try {
            const stmt = this.db.prepare('SELECT * FROM user_devices WHERE mac = ?');
            return stmt.all(mac).map(row => this._rowToDevice(row));
        } catch (error) {
            console.error('Error getting rows for MAC:', error);
            return [];
        }
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    _rowToDevice(row) {
        return {
            id: row.id,
            userId: row.user_id,
            mac: row.mac,
            name: row.name,
            description: row.description,
            rustdeskId: row.rustdesk_id,
            isFavorite: row.is_favorite === 1,
            ip: row.last_ip,
            status: row.status,
            lastSeen: row.last_seen,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = Device;
