import database from './Database';
import Database from 'better-sqlite3';

export type HomeSectionKind = 'recents' | 'internal' | 'external' | 'custom';

export interface HomeSection {
    id: string;
    kind: HomeSectionKind;
    title: string;
    hidden: boolean;
    collapsed: boolean;
    /** Card ids for custom sections only */
    cardIds: string[];
}

export type HomeCard =
    | { id: string; type: 'catalog'; catalogId: string }
    | {
          id: string;
          type: 'custom';
          title: string;
          url: string;
          description?: string;
          /** `mui:IconName` or `emoji:…` */
          icon: string;
      };

export function defaultHomeLayout(): HomeSection[] {
    return [
        { id: 'recents', kind: 'recents', title: 'Recents', hidden: false, collapsed: false, cardIds: [] },
        { id: 'internal', kind: 'internal', title: 'Pages', hidden: false, collapsed: false, cardIds: [] },
        { id: 'external', kind: 'external', title: 'Services', hidden: false, collapsed: false, cardIds: [] },
    ];
}

// Default user settings - these define the available settings and their defaults
export interface UserSettingsData {
    defaultHomePage: string;
    deviceListView: string;
    showOfflineDevices: boolean;
    devicesPerPage: number;
    compactMode: boolean;
    homeRecentIds: string[];
    homeLayout: HomeSection[];
    homeCards: HomeCard[];
    [key: string]: unknown;
}

const DEFAULT_USER_SETTINGS: UserSettingsData = {
    defaultHomePage: 'home',
    deviceListView: 'grid',
    showOfflineDevices: true,
    devicesPerPage: 25,
    compactMode: false,
    homeRecentIds: [],
    homeLayout: defaultHomeLayout(),
    homeCards: [],
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

        const userOverrides: Record<string, unknown> = {};
        for (const row of rows) {
            try {
                userOverrides[row.key] = JSON.parse(row.value);
            } catch {
                userOverrides[row.key] = row.value;
            }
        }

        return { ...DEFAULT_USER_SETTINGS, ...userOverrides };
    }

    /** Atomically prepend a home recent id (safe under multi-tab / rapid clicks). */
    prependRecent(userId: number, id: string, cap = 8): string[] {
        if (!id || typeof id !== 'string') {
            return this.get(userId).homeRecentIds;
        }
        return this.db.transaction(() => {
            const row = this.db.prepare(
                'SELECT value FROM user_settings WHERE user_id = ? AND key = ?'
            ).get(userId, 'homeRecentIds') as { value: string } | undefined;

            let current: string[] = [];
            if (row?.value) {
                try {
                    const parsed = JSON.parse(row.value);
                    if (Array.isArray(parsed)) current = parsed.filter((x) => typeof x === 'string');
                } catch {
                    current = [];
                }
            }

            const next = [id, ...current.filter((x) => x !== id)].slice(0, cap);
            this.set(userId, 'homeRecentIds', next);
            return next;
        })();
    }

    // Set a single setting for a user
    set(userId: number, key: string, value: unknown) {
        this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        ).run(userId, key, JSON.stringify(value));
    }

    // Bulk update settings for a user
    setAll(userId: number, settings: Record<string, unknown>): UserSettingsData {
        const upsert = this.db.prepare(
            `INSERT INTO user_settings (user_id, key, value)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
        );

        const transaction = this.db.transaction((entries: [string, unknown][]) => {
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
        return {
            ...DEFAULT_USER_SETTINGS,
            homeLayout: defaultHomeLayout(),
            homeCards: [],
        };
    }
}

export default UserSettings;
