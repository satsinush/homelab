import database from './Database';
import Database from 'better-sqlite3';

// Default user settings - these define the available settings and their defaults
export interface UserSettingsData {
    defaultHomePage: string;
    deviceListView: string;
    showOfflineDevices: boolean;
    devicesPerPage: number;
    compactMode: boolean;
    [key: string]: any;
}

const DEFAULT_USER_SETTINGS: UserSettingsData = {
    defaultHomePage: 'home',
    deviceListView: 'grid',
    showOfflineDevices: true,
    devicesPerPage: 25,
    compactMode: false,
};

class UserSettings {
    private db: Database.Database;

    constructor() {
        this.db = database.getDatabase();
    }

    // Get all settings for a user, merged with defaults
    get(userId: number): UserSettingsData {
        const rows = this.db.prepare(
            'SELECT key, value FROM user_settings WHERE user_id = ?'
        ).all(userId) as Array<{ key: string; value: string }>;

        const userOverrides: Record<string, any> = {};
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
    set(userId: number, key: string, value: any) {
        this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        ).run(userId, key, JSON.stringify(value));
    }

    // Bulk update settings for a user
    setAll(userId: number, settings: Record<string, any>): UserSettingsData {
        const upsert = this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        );

        const transaction = this.db.transaction((entries: [string, any][]) => {
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
    delete(userId: number, key: string) {
        this.db.prepare(
            'DELETE FROM user_settings WHERE user_id = ? AND key = ?'
        ).run(userId, key);
    }

    // Delete all settings for a user
    deleteAll(userId: number) {
        this.db.prepare(
            'DELETE FROM user_settings WHERE user_id = ?'
        ).run(userId);
    }

    // Get the defaults (for the frontend to know available settings)
    getDefaults(): UserSettingsData {
        return { ...DEFAULT_USER_SETTINGS };
    }
}

export default UserSettings;
