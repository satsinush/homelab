import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config';

class DatabaseModel {
    private db!: Database.Database;

    constructor() {
        this.init();
    }

    private init() {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(config.database.path)) {
            fs.mkdirSync(config.database.path, { recursive: true });
        }

        // Initialize SQLite database
        const dbPath = path.join(config.database.path, config.database.filename);
        this.db = new Database(dbPath);

        this.db.pragma('journal_mode = WAL');

        // Initialize database tables
        this.createTables();
    }

    private createTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_devices (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                mac         TEXT NOT NULL,
                name        TEXT,
                description TEXT,
                rustdesk_id TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 1,
                last_ip     TEXT,
                status      TEXT NOT NULL DEFAULT 'offline',
                last_seen   DATETIME,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, mac),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_devices_mac ON user_devices(mac);

            CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT,
                salt TEXT,
                groups TEXT NOT NULL DEFAULT '[]',
                roles TEXT NOT NULL DEFAULT '[]',
                email TEXT,
                sso_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            CREATE TABLE IF NOT EXISTS chat_conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                messages TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at);

            CREATE TABLE IF NOT EXISTS user_settings (
                user_id  INTEGER NOT NULL,
                key      TEXT NOT NULL,
                value    TEXT,
                PRIMARY KEY (user_id, key),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS package_update_notifications (
                name TEXT PRIMARY KEY,
                notified_version TEXT NOT NULL,
                last_notified_at INTEGER NOT NULL
            );
        `);
    }

    getDatabase(): Database.Database {
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Export singleton instance
const databaseInstance = new DatabaseModel();
export default databaseInstance;
