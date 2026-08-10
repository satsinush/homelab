import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import database from './Database';
import config from '../config';
import Database from 'better-sqlite3';

export interface UserProfile {
    id: number;
    username: string;
    groups: string[];
    roles: string[];
    email: string | null;
    has_local_password?: boolean;
    lastLogin?: string;
    createdAt?: string;
    sso_id?: string;
}

interface DatabaseUserRow {
    id: number;
    username: string;
    password_hash?: string;
    salt?: string;
    groups: string;
    roles: string;
    email: string | null;
    is_sso_user: number;
    sso_id?: string;
    created_at: string;
    updated_at: string;
    last_login: string | null;
}

export interface SSOProfile {
    sub: string;
    preferred_username?: string;
    name?: string;
    email?: string;
    groups?: string[];
    roles?: string[];
}

class User {
    private db: Database.Database;

    constructor() {
        this.db = database.getDatabase();
    }

    // Check if this is the first user (no users exist)
    async isFirstUser(): Promise<boolean> {
        try {
            const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
            const result = checkStmt.get() as { count: number } | undefined;
            return result ? result.count === 0 : false;
        } catch (error) {
            console.error('Error checking if first user:', error);
            return false;
        }
    }

    // Create the first user with any credentials
    async createFirstUser(username: string, password: string, email: string | null = null): Promise<UserProfile> {
        try {
            const salt = uuidv4();
            const passwordHash = await argon2.hash(password, { salt: Buffer.from(salt) });
            
            const insertStmt = this.db.prepare(`
                INSERT INTO users (username, password_hash, salt, groups, roles, email) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(username, passwordHash, salt, JSON.stringify(['admin']), JSON.stringify(['homelab-admin']), email);
            console.log(`First user created: ${username} with admin privileges`);
            
            return {
                id: Number(result.lastInsertRowid),
                username: username,
                groups: ['admin'],
                roles: ['homelab-admin'],
                email: email,
                lastLogin: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error creating first user:', error);
            throw error;
        }
    }

    async createLocalUser(username: string, password: string, email: string | null = null): Promise<UserProfile> {
        try {
            const salt = uuidv4();
            const passwordHash = await argon2.hash(password, { salt: Buffer.from(salt) });
            
            const insertStmt = this.db.prepare(`
                INSERT INTO users (username, password_hash, salt, groups, roles, email) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(
                username,
                passwordHash,
                salt,
                JSON.stringify(['user']),
                JSON.stringify([]),
                email
            );
            
            return {
                id: Number(result.lastInsertRowid),
                username: username,
                groups: ['user'],
                roles: [],
                email: email,
                has_local_password: true
            };
        } catch (error) {
            console.error('Error creating local user:', error);
            throw error;
        }
    }

    async updateLocalPassword(username: string, password: string): Promise<void> {
        const stmt = this.db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
        const user = stmt.get(username) as { id: number } | undefined;
        if (!user) {
            await this.createLocalUser(username, password);
            return;
        }
        
        const salt = uuidv4();
        const passwordHash = await argon2.hash(password, { salt: Buffer.from(salt) });
        const updateStmt = this.db.prepare(`
            UPDATE users 
            SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        updateStmt.run(passwordHash, salt, user.id);
    }

    // Authenticate user (for local login)
    async authenticate(username: string, password: string): Promise<UserProfile | null> {
        try {
            // Check if this is the first user
            if (await this.isFirstUser()) {
                console.log('No users exist - creating first user from login attempt');
                const email = `${username}@${config.homelabHostname || 'homelab.home.arpa'}`;
                return await this.createFirstUser(username, password, email);
            }

            const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
            const user = stmt.get(username) as DatabaseUserRow | undefined;
            
            if (!user || !user.password_hash) {
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
                roles: JSON.parse(user.roles || '[]'),
                email: user.email,
                has_local_password: !!user.password_hash,
                sso_id: user.sso_id,
                lastLogin: user.last_login || undefined
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    // Create or update SSO user
    async createOrUpdateSSOUser(ssoProfile: SSOProfile): Promise<UserProfile> {
        try {
            // Extract user info from Authentik OIDC profile
            const ssoId = ssoProfile.sub;
            const username = ssoProfile.preferred_username || ssoProfile.name || 'sso-user';
            const email = ssoProfile.email || null;
            
            // Use groups and roles mapping
            const userGroups = ssoProfile.groups || [];
            const userRoles = ssoProfile.roles || [];

            // Check if SSO user already exists by sso_id
            const ssoUserStmt = this.db.prepare('SELECT * FROM users WHERE sso_id = ?');
            const user = ssoUserStmt.get(ssoId) as DatabaseUserRow | undefined;

            if (user) {
                // Update existing SSO user - always sync roles from Authentik
                console.log(`Updating existing SSO user: ${username}`);
                console.log(`Previous groups: ${JSON.stringify(JSON.parse(user.groups))}`);
                console.log(`New groups from SSO: ${JSON.stringify(userGroups)}`);
                console.log(`New roles from SSO: ${JSON.stringify(userRoles)}`);
                
                // Always update groups and roles to match what Authentik provides
                const updateStmt = this.db.prepare(`
                    UPDATE users 
                    SET username = ?, email = ?, groups = ?, roles = ?, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `);
                updateStmt.run(username, email, JSON.stringify(userGroups), JSON.stringify(userRoles), user.id);
                                
                return {
                    id: user.id,
                    username: username,
                    groups: userGroups,
                    roles: userRoles,
                    email: email,
                    sso_id: ssoId,
                    lastLogin: new Date().toISOString()
                };
            } else {
                let existingUser: DatabaseUserRow | undefined = undefined;
                if (email) {
                    console.log(`No user found with matching OIDC ID, checking for user with email: ${email}`);
                    const existingUserStmt = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
                    existingUser = existingUserStmt.get(email) as DatabaseUserRow | undefined;
                }

                if (!existingUser && username) {
                    console.log(`No user found by email, checking for user with username: ${username}`);
                    const existingUserStmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
                    existingUser = existingUserStmt.get(username) as DatabaseUserRow | undefined;
                }

                if (existingUser) {
                    // Map SSO user to existing user by updating their details and OIDC mapping
                    console.log(`Linking/updating SSO profile for existing user: ${existingUser.username}`);
                    
                    const updateStmt = this.db.prepare(`
                        UPDATE users 
                        SET username = ?, email = ?, groups = ?, roles = ?, sso_id = ?, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `);
                    updateStmt.run(username, email, JSON.stringify(userGroups), JSON.stringify(userRoles), ssoId, existingUser.id);
                                        
                    return {
                        id: existingUser.id,
                        username: username,
                        groups: userGroups,
                        roles: userRoles,
                        email: email,
                        sso_id: ssoId,
                        lastLogin: new Date().toISOString()
                    };
                } else {
                    // Create new SSO user
                    const insertStmt = this.db.prepare(`
                        INSERT INTO users (username, email, groups, roles, sso_id, last_login) 
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `);
                    const result = insertStmt.run(username, email, JSON.stringify(userGroups), JSON.stringify(userRoles), ssoId);
                    
                    return {
                        id: Number(result.lastInsertRowid),
                        username: username,
                        groups: userGroups,
                        roles: userRoles,
                        email: email,
                        sso_id: ssoId,
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
    async updateProfile(userId: number, username: string, currentPassword?: string, newPassword?: string): Promise<UserProfile> {
        try {
            // Get current user data
            const userStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
            const user = userStmt.get(userId) as DatabaseUserRow | undefined;
            
            if (!user) {
                throw new Error('User not found');
            }

            // If changing password, verify current password if one is already set
            if (newPassword && user.password_hash) {
                const isCurrentPasswordValid = await argon2.verify(user.password_hash, currentPassword || '');
                if (!isCurrentPasswordValid) {
                    throw new Error('Current password is incorrect');
                }
            }
            
            // Check if username is already taken (by another user)
            const existingUserStmt = this.db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?');
            const existingUser = existingUserStmt.get(username, userId) as DatabaseUserRow | undefined;
            
            if (existingUser) {
                throw new Error('Username is already taken');
            }
            
            // Update user data
            if (newPassword) {
                const hashedPassword = await argon2.hash(newPassword);
                const updateStmt = this.db.prepare('UPDATE users SET username = ?, password_hash = ?, salt = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                updateStmt.run(username, hashedPassword, userId);
            } else {
                const updateStmt = this.db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                updateStmt.run(username, userId);
            }
            
            return {
                id: userId,
                username: username,
                groups: JSON.parse(user.groups),
                roles: JSON.parse(user.roles || '[]'),
                email: user.email,
                sso_id: user.sso_id
            };
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }

    // Get user by ID
    getUserById(userId: number): UserProfile | null {
        try {
            const stmt = this.db.prepare('SELECT id, username, password_hash, groups, roles, email, sso_id FROM users WHERE id = ?');
            const user = stmt.get(userId) as DatabaseUserRow | undefined;
            
            if (!user) {
                return null;
            }
            
            return {
                id: user.id,
                username: user.username,
                groups: JSON.parse(user.groups),
                roles: JSON.parse(user.roles || '[]'),
                email: user.email,
                has_local_password: !!user.password_hash,
                sso_id: user.sso_id
            };
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // Get all users in the system
    getAllUsers(): UserProfile[] {
        try {
            const stmt = this.db.prepare('SELECT id, username, password_hash, groups, roles, email, sso_id, last_login, created_at FROM users ORDER BY id ASC');
            const rows = stmt.all() as DatabaseUserRow[];
            return rows.map(user => ({
                id: user.id,
                username: user.username,
                groups: JSON.parse(user.groups),
                roles: JSON.parse(user.roles || '[]'),
                email: user.email,
                has_local_password: !!user.password_hash,
                sso_id: user.sso_id,
                lastLogin: user.last_login || undefined,
                createdAt: user.created_at
            }));
        } catch (error) {
            console.error('Get all users error:', error);
            return [];
        }
    }

    // Delete a user from the system
    deleteUser(userId: number): boolean {
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

export default User;
