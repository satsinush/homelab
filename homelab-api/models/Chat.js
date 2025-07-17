const database = require('./Database');
const config = require('../config');

class Chat {
    constructor() {
        this.db = database.getDatabase();
    }

    // Get number of conversations
    getConversationCount() {
        try {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_conversations');
            return stmt.get().count;
        } catch (error) {
            console.error('Error getting conversation count from database:', error);
            return 0;
        }
    }

    // Get conversation from database
    getConversation(userId) {
        console.log(`Getting conversation for user ${userId}`);
        try {
            const stmt = this.db.prepare('SELECT messages FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
            const result = stmt.get(userId);
            
            if (result && result.messages) {
                return JSON.parse(result.messages);
            }
            return [];
        } catch (error) {
            console.error('Error getting conversation from database:', error);
            return [];
        }
    }

    // Save conversation to database
    saveConversation(userId, messages) {
        try {
            const messagesJson = JSON.stringify(messages);
            
            // Check if conversation exists
            const existsStmt = this.db.prepare('SELECT id FROM chat_conversations WHERE user_id = ?');
            const existing = existsStmt.get(userId);
            
            if (existing) {
                // Update existing conversation
                const updateStmt = this.db.prepare('UPDATE chat_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
                updateStmt.run(messagesJson, userId);
            } else {
                // Insert new conversation
                const insertStmt = this.db.prepare('INSERT INTO chat_conversations (user_id, messages) VALUES (?, ?)');
                insertStmt.run(userId, messagesJson);
            }
        } catch (error) {
            console.error('Error saving conversation to database:', error);
        }
    }

    // Delete conversation from database
    deleteConversation(userId) {
        try {
            const stmt = this.db.prepare('DELETE FROM chat_conversations WHERE user_id = ?');
            const result = stmt.run(userId);
            return result.changes;
        } catch (error) {
            console.error('Error deleting conversation from database:', error);
            return 0;
        }
    }

    // Clean up old conversations
    cleanupOldConversations(cutoffTime) {
        try {
            // Delete conversations older than TTL
            const deleteStmt = this.db.prepare('DELETE FROM chat_conversations WHERE updated_at < ?');
            const result = deleteStmt.run(cutoffTime);
            
            if (result.changes > 0) {
                console.log(`Cleaned up ${result.changes} old conversations older than ${new Date(cutoffTime).toLocaleString()}`);
            }
        } catch (error) {
            console.error('Error during conversation cleanup:', error);
        }
    }

    // Manual cleanup method
    clearAllConversations() {
        try {
            const deleteStmt = this.db.prepare('DELETE FROM chat_conversations');
            const result = deleteStmt.run();
            return result.changes;
        } catch (error) {
            console.error('Error clearing all conversations:', error);
            return 0;
        }
    }
}

module.exports = Chat;
