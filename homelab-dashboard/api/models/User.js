const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('./Database');
const config = require('../config');

class User {
    constructor() {
        this.db = database.getDatabase();
    }

    // Create default admin user
    async createDefaultUser() {
        try {
            const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
            const result = checkStmt.get();
            
            if (result.count === 0) {
                const salt = uuidv4();
                const passwordHash = await argon2.hash('password', { salt: Buffer.from(salt) });
                
                const insertStmt = this.db.prepare(`
                    INSERT INTO users (username, password_hash, salt, roles) 
                    VALUES (?, ?, ?, ?)
                `);
                
                insertStmt.run('admin', passwordHash, salt, JSON.stringify(['admin']));
                console.log('Default admin user created (username: admin, password: password)');
            }
        } catch (error) {
            console.error('Error creating default user:', error);
        }
    }

    // Authenticate user
    async authenticate(username, password) {
        try {
            const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
            const user = stmt.get(username);
            
            if (!user) {
                return null;
            }
            
            const isValid = await argon2.verify(user.password_hash, password);
            
            if (!isValid) {
                return null;
            }
            
            // Update last login
            const updateStmt = this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
            updateStmt.run(user.id);
            
            return {
                id: user.id,
                username: user.username,
                roles: JSON.parse(user.roles),
                lastLogin: user.last_login
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    // Create JWT token for user
    createToken(userId) {
        try {
            const token = jwt.sign(
                { 
                    userId,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
                },
                config.jwtSecret
            );
            
            const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
            
            return { token, expiresAt };
        } catch (error) {
            console.error('Token creation error:', error);
            return null;
        }
    }

    // Verify JWT token
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            
            // Get user data
            const stmt = this.db.prepare(`
                SELECT u.id, u.username, u.roles 
                FROM users u 
                WHERE u.id = ?
            `);
            
            const user = stmt.get(decoded.userId);
            
            if (!user) {
                return null;
            }
            
            return {
                userId: user.id,
                username: user.username,
                roles: JSON.parse(user.roles)
            };
        } catch (error) {
            console.error('Token verification error:', error);
            return null;
        }
    }

    // Update user profile
    async updateProfile(userId, username, currentPassword, newPassword) {
        try {
            // Note: Validation handled by controller, inputs are already validated
            
            // Get current user data
            const userStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
            const user = userStmt.get(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // If changing password, verify current password
            if (newPassword) {
                const isCurrentPasswordValid = await argon2.verify(user.password_hash, currentPassword);
                if (!isCurrentPasswordValid) {
                    throw new Error('Current password is incorrect');
                }
            }
            
            // Check if username is already taken (by another user)
            const existingUserStmt = this.db.prepare('SELECT id FROM users WHERE username = ? AND id != ?');
            const existingUser = existingUserStmt.get(username, userId);
            
            if (existingUser) {
                throw new Error('Username is already taken');
            }
            
            // Update user data
            if (newPassword) {
                const hashedPassword = await argon2.hash(newPassword);
                const updateStmt = this.db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?');
                updateStmt.run(username, hashedPassword, userId);
            } else {
                const updateStmt = this.db.prepare('UPDATE users SET username = ? WHERE id = ?');
                updateStmt.run(username, userId);
            }
            
            return {
                id: userId,
                username: username,
                roles: JSON.parse(user.roles)
            };
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }

    // Get user by ID
    getUserById(userId) {
        try {
            const stmt = this.db.prepare('SELECT id, username, roles FROM users WHERE id = ?');
            const user = stmt.get(userId);
            
            if (!user) {
                return null;
            }
            
            return {
                id: user.id,
                username: user.username,
                roles: JSON.parse(user.roles)
            };
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }
}

module.exports = User;
