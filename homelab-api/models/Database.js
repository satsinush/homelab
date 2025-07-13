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
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                roles TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                expired INTEGER NOT NULL,
                sess TEXT NOT NULL
            );
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
