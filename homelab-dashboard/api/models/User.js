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
    async createFirstUser(username, password) {
        try {
            const salt = uuidv4();
            const passwordHash = await argon2.hash(password, { salt: Buffer.from(salt) });
            
            const insertStmt = this.db.prepare(`
                INSERT INTO users (username, password_hash, salt, groups) 
                VALUES (?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(username, passwordHash, salt, JSON.stringify(['admin']));
            console.log(`First user created: ${username} with admin privileges`);
            
            return {
                id: result.lastInsertRowid,
                username: username,
                groups: ['admin'],
                email: null,
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
                return await this.createFirstUser(username, password);
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
            // Extract user info from Authelia OIDC profile
            const ssoId = ssoProfile.sub; // 'sub' is the standard OIDC user identifier
            const username = ssoProfile.preferred_username || ssoProfile.name; // Use preferred_username first, fallback to name
            const email = ssoProfile.email || null; // Authelia provides email directly
            
            // Use custom claims for role mapping instead of groups
            let userGroups = [];            
            if (ssoProfile.homelab_role) {
                // Use the custom homelab_role claim from Authelia
                if (ssoProfile.homelab_role === 'admin') {
                    userGroups = ['admin'];
                } else if (ssoProfile.homelab_role === 'user') {
                    userGroups = ['user'];
                }
            }

            // Check if SSO user already exists by sso_id
            let user;
            const ssoUserStmt = this.db.prepare('SELECT * FROM users WHERE sso_id = ? AND is_sso_user = 1');
            user = ssoUserStmt.get(ssoId);

            if (user) {
                // Update existing SSO user - always sync roles from LDAP/Authelia
                console.log(`Updating existing SSO user: ${username}`);
                console.log(`Previous groups: ${JSON.stringify(JSON.parse(user.groups))}`);
                console.log(`New groups from SSO: ${JSON.stringify(userGroups)}`);
                
                // Always update groups to match what LDAP/Authelia provides
                // This ensures role revocations in LDAP are reflected in the dashboard
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
                console.log('No existing SSO user found, checking for local user with same username');
                // Check if a local user exists with the same username
                const localUserStmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND is_sso_user = 0');
                const localUser = localUserStmt.get(username);

                if (localUser) {
                    // Map SSO user to existing local user by updating their groups and marking as SSO-linked
                    console.log(`Linking SSO profile to existing local user: ${username}`);
                    console.log(`Previous local user groups: ${JSON.stringify(JSON.parse(localUser.groups))}`);
                    console.log(`New groups from SSO: ${JSON.stringify(userGroups)}`);
                    
                    // Always update groups to match what LDAP/Authelia provides
                    // This ensures role changes in LDAP are reflected for linked local users
                    const updateStmt = this.db.prepare(`
                        UPDATE users 
                        SET email = ?, groups = ?, sso_id = ?, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `);
                    updateStmt.run(email, JSON.stringify(userGroups), ssoId, localUser.id);
                                        
                    return {
                        id: localUser.id,
                        username: username,
                        groups: userGroups,
                        email: email,
                        is_sso_user: false, // Keep as local user but now SSO-linked
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
}

module.exports = User;
