const argon2 = require('argon2');
const { v4: uuidv4 } = require('uuid');
const database = require('./Database');
const config = require('../config');

class User {
    constructor() {
        this.db = database.getDatabase();
    }

    // Check if this is the first user (no users exist)
    async isFirstUser() {
        try {
            const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
            const result = checkStmt.get();
            return result.count === 0;
        } catch (error) {
            console.error('Error checking if first user:', error);
            return false;
        }
    }

    // Create the first user with any credentials
    async createFirstUser(username, password, email = null) {
        try {
            const salt = uuidv4();
            const passwordHash = await argon2.hash(password, { salt: Buffer.from(salt) });
            
            const insertStmt = this.db.prepare(`
                INSERT INTO users (username, password_hash, salt, groups, email) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(username, passwordHash, salt, JSON.stringify(['admin']), email);
            console.log(`First user created: ${username} with admin privileges`);
            
            return {
                id: result.lastInsertRowid,
                username: username,
                groups: ['admin'],
                email: email,
                is_sso_user: false,
                lastLogin: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error creating first user:', error);
            throw error;
        }
    }

    // Authenticate user (for local login)
    async authenticate(username, password) {
        try {
            // Check if this is the first user
            if (await this.isFirstUser()) {
                console.log('No users exist - creating first user from login attempt');
                const email = `${username}@${config.homelabHostname || 'homelab.home.arpa'}`;
                return await this.createFirstUser(username, password, email);
            }

            const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND is_sso_user = 0');
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
                groups: JSON.parse(user.groups),
                email: user.email,
                is_sso_user: false,
                lastLogin: user.last_login
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    // Create or update SSO user
    async createOrUpdateSSOUser(ssoProfile) {
        try {
            // Extract user info from Authentik OIDC profile
            const ssoId = ssoProfile.sub; // 'sub' is the standard OIDC user identifier
            const username = ssoProfile.preferred_username || ssoProfile.name; // Use preferred_username first, fallback to name
            const email = ssoProfile.email || null; // Authentik provides email directly
            
            // Use groups for role mapping
            let userGroups = [];            
            if (ssoProfile.groups) {
                if (ssoProfile.groups.includes('homelab_admins')) {
                    userGroups = ['admin'];
                } else if (ssoProfile.groups.includes('homelab_users')) {
                    userGroups = ['user'];
                }
            }

            // Check if SSO user already exists by sso_id
            let user;
            const ssoUserStmt = this.db.prepare('SELECT * FROM users WHERE sso_id = ? AND is_sso_user = 1');
            user = ssoUserStmt.get(ssoId);

            if (user) {
                // Update existing SSO user - always sync roles from Authentik
                console.log(`Updating existing SSO user: ${username}`);
                console.log(`Previous groups: ${JSON.stringify(JSON.parse(user.groups))}`);
                console.log(`New groups from SSO: ${JSON.stringify(userGroups)}`);
                
                // Always update groups to match what Authentik provides
                // This ensures role revocations in Authentik are reflected in the dashboard
                const updateStmt = this.db.prepare(`
                    UPDATE users 
                    SET username = ?, email = ?, groups = ?, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `);
                updateStmt.run(username, email, JSON.stringify(userGroups), user.id);
                                
                return {
                    id: user.id,
                    username: username,
                    groups: userGroups,
                    email: email,
                    is_sso_user: true,
                    lastLogin: new Date().toISOString()
                };
            } else {
                let existingUser = null;
                if (email) {
                    console.log(`No user found with matching OIDC ID, checking for user with email: ${email}`);
                    const existingUserStmt = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
                    existingUser = existingUserStmt.get(email);
                }

                if (existingUser) {
                    // Map SSO user to existing user by updating their details and OIDC mapping
                    console.log(`Linking/updating SSO profile for existing user: ${existingUser.username}`);
                    console.log(`Previous groups: ${JSON.stringify(JSON.parse(existingUser.groups))}`);
                    console.log(`New groups from SSO: ${JSON.stringify(userGroups)}`);
                    
                    const updateStmt = this.db.prepare(`
                        UPDATE users 
                        SET username = ?, email = ?, groups = ?, sso_id = ?, is_sso_user = 1, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `);
                    updateStmt.run(username, email, JSON.stringify(userGroups), ssoId, existingUser.id);
                                        
                    return {
                        id: existingUser.id,
                        username: username,
                        groups: userGroups,
                        email: email,
                        is_sso_user: true,
                        lastLogin: new Date().toISOString()
                    };
                } else {
                    // Create new SSO user
                    const insertStmt = this.db.prepare(`
                        INSERT INTO users (username, email, groups, is_sso_user, sso_id, last_login) 
                        VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                    `);
                    const result = insertStmt.run(username, email, JSON.stringify(userGroups), ssoId);
                    
                    return {
                        id: result.lastInsertRowid,
                        username: username,
                        groups: userGroups,
                        email: email,
                        is_sso_user: true,
                        lastLogin: new Date().toISOString()
                    };
                }
            }
        } catch (error) {
            console.error('SSO user creation/update error:', error);
            throw error;
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

            // SSO users cannot change passwords locally
            if (user.is_sso_user && newPassword) {
                throw new Error('SSO users cannot change passwords locally');
            }
            
            // If changing password for local user, verify current password
            if (newPassword && !user.is_sso_user) {
                if (!user.password_hash) {
                    throw new Error('Local user has no password set');
                }
                const isCurrentPasswordValid = await argon2.verify(user.password_hash, currentPassword);
                if (!isCurrentPasswordValid) {
                    throw new Error('Current password is incorrect');
                }
            }
            
            // Check if username is already taken (by another user)
            const existingUserStmt = this.db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?');
            const existingUser = existingUserStmt.get(username, userId);
            
            if (existingUser) {
                throw new Error('Username is already taken');
            }
            
            // Update user data
            if (newPassword && !user.is_sso_user) {
                const hashedPassword = await argon2.hash(newPassword);
                const updateStmt = this.db.prepare('UPDATE users SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                updateStmt.run(username, hashedPassword, userId);
            } else {
                const updateStmt = this.db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                updateStmt.run(username, userId);
            }
            
            return {
                id: userId,
                username: username,
                groups: JSON.parse(user.groups),
                email: user.email,
                is_sso_user: user.is_sso_user
            };
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }

    // Get user by ID
    getUserById(userId) {
        try {
            const stmt = this.db.prepare('SELECT id, username, groups, email, is_sso_user FROM users WHERE id = ?');
            const user = stmt.get(userId);
            
            if (!user) {
                return null;
            }
            
            return {
                id: user.id,
                username: user.username,
                groups: JSON.parse(user.groups),
                email: user.email,
                is_sso_user: user.is_sso_user
            };
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // Get all users in the system
    getAllUsers() {
        try {
            const stmt = this.db.prepare('SELECT id, username, groups, email, is_sso_user, last_login, created_at FROM users ORDER BY id ASC');
            const rows = stmt.all();
            return rows.map(user => ({
                id: user.id,
                username: user.username,
                groups: JSON.parse(user.groups),
                email: user.email,
                is_sso_user: user.is_sso_user,
                lastLogin: user.last_login,
                createdAt: user.created_at
            }));
        } catch (error) {
            console.error('Get all users error:', error);
            return [];
        }
    }

    // Delete a user from the system
    deleteUser(userId) {
        try {
            const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
            const result = stmt.run(userId);
            return result.changes > 0;
        } catch (error) {
            console.error('Delete user error:', error);
            throw error;
        }
    }
}

module.exports = User;
