import database from './Database';
import config, { DefaultSettings } from '../config';
import Database from 'better-sqlite3';

class Settings {
    private db: Database.Database;
    private serverSettings: DefaultSettings & Record<string, any>;

    constructor() {
        this.db = database.getDatabase();
        this.serverSettings = { ...config.defaultSettings };
        this.load();
    }

    // Load settings from database
    load() {
        try {
            const settingsStmt = this.db.prepare('SELECT data FROM settings WHERE id = ?');
            const result = settingsStmt.get('server-config') as { data: string } | undefined;
            
            if (result) {
                this.serverSettings = { ...config.defaultSettings, ...JSON.parse(result.data) };
            } else {
                // Insert default settings
                const insertStmt = this.db.prepare('INSERT INTO settings (id, data) VALUES (?, ?)');
                insertStmt.run('server-config', JSON.stringify(config.defaultSettings));
                console.log('Default settings created');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    // Get current settings
    get() {
        return this.serverSettings;
    }

    // Update settings
    update(newSettings: Record<string, any>) {
        try {
            const updatedSettings = { ...this.serverSettings, ...newSettings };
            
            const stmt = this.db.prepare('UPDATE settings SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            const result = stmt.run(JSON.stringify(updatedSettings), 'server-config');
            
            if (result.changes === 0) {
                // Insert if doesn't exist
                const insertStmt = this.db.prepare('INSERT INTO settings (id, data) VALUES (?, ?)');
                insertStmt.run('server-config', JSON.stringify(updatedSettings));
            }
            
            this.serverSettings = updatedSettings;
            return this.serverSettings;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }

    // Get cache timeout from settings
    getCacheTimeout(): number {
        return this.serverSettings.cacheTimeout || 300000;
    }

    // Get scan timeout from settings
    getScanTimeout(): number {
        return this.serverSettings.scanTimeout || 30000;
    }

    // Get services list from settings
    getServices(): any[] {
        return this.serverSettings.services || [];
    }
}

export default Settings;
