const database = require('./Database');

// Default user settings - these define the available settings and their defaults
const DEFAULT_USER_SETTINGS = {
    defaultHomePage: 'home',           // 'home' or 'devices'
    deviceListView: 'grid',            // 'grid' or 'list'
    showOfflineDevices: true,          // show offline devices in device list
    devicesPerPage: 25,                // number of devices per page
    compactMode: false,                // compact UI mode
};

class UserSettings {
    constructor() {
        this.db = database.getDatabase();
    }

    // Get all settings for a user, merged with defaults
    get(userId) {
        const rows = this.db.prepare(
            'SELECT key, value FROM user_settings WHERE user_id = ?'
        ).all(userId);

        const userOverrides = {};
        for (const row of rows) {
            try {
                userOverrides[row.key] = JSON.parse(row.value);
            } catch {
                userOverrides[row.key] = row.value;
            }
        }

        return { ...DEFAULT_USER_SETTINGS, ...userOverrides };
    }

    // Set a single setting for a user
    set(userId, key, value) {
        this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        ).run(userId, key, JSON.stringify(value));
    }

    // Bulk update settings for a user
    setAll(userId, settings) {
        const upsert = this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        );

        const transaction = this.db.transaction((entries) => {
            for (const [key, value] of entries) {
                // Only save keys that are valid defaults
                if (key in DEFAULT_USER_SETTINGS) {
                    upsert.run(userId, key, JSON.stringify(value));
                }
            }
        });

        transaction(Object.entries(settings));
        return this.get(userId);
    }

    // Delete a single setting (reverts to default)
    delete(userId, key) {
        this.db.prepare(
            'DELETE FROM user_settings WHERE user_id = ? AND key = ?'
        ).run(userId, key);
    }

    // Delete all settings for a user
    deleteAll(userId) {
        this.db.prepare(
            'DELETE FROM user_settings WHERE user_id = ?'
        ).run(userId);
    }

    // Get the defaults (for the frontend to know available settings)
    getDefaults() {
        return { ...DEFAULT_USER_SETTINGS };
    }
}

module.exports = UserSettings;
