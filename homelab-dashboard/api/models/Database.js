const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

class DatabaseModel {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
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

    createTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS devices (
                mac TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

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
                email TEXT,
                is_sso_user BOOLEAN DEFAULT 0,
                sso_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                expired INTEGER NOT NULL,
                sess TEXT NOT NULL
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
        `);
    }

    getDatabase() {
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
module.exports = databaseInstance;
