import { Request, Response } from 'express';
import User, { SSOProfile } from '../models/User';
import ValidationUtils from '../utils/validation';
import { sendError, sendSuccess } from '../utils/response';
import config from '../config';
import HostApiService from '../services/hostApiService';

import { getErrorMessage } from '../utils/errors';

/** Host API wraps validation failures as "Host API error: 400 - <msg>" — unwrap for the UI. */
function friendlyHostApiError(error: unknown): string {
    const raw = getErrorMessage(error);
    const match = raw.match(/Host API error: \d+ - (.+)$/);
    return match ? match[1] : raw;
}

function friendlySsoErrorMessage(error: unknown): string {
    const raw = getErrorMessage(error).toLowerCase();
    if (
        raw.includes('unexpected http response status code') ||
        raw.includes('discovery') ||
        raw.includes('econnrefused') ||
        raw.includes('enotfound') ||
        raw.includes('etimedout') ||
        raw.includes('fetch failed') ||
        raw.includes('network') ||
        raw.includes('certificate') ||
        raw.includes('ssl') ||
        raw.includes('tls')
    ) {
        return 'Error signing in with SSO. Please wait a moment and try again.';
    }
    return 'SSO sign-in failed. Please try again in a moment.';
}

class UserController {
    private userModel: User;
    private hostApi: HostApiService;

    constructor() {
        this.userModel = new User();
        this.hostApi = new HostApiService();
    }

    // Login endpoint
    async login(req: Request, res: Response) {
        try {
            // Check if local auth is disabled
            if (config.disableLocalAuth) {
                return sendError(res, 403, 'Local authentication is disabled. Please use SSO to sign in.');
            }

            const { username, password } = req.body;
            
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }
            
            // Validate input at controller level
            let validatedCredentials;
            try {
                validatedCredentials = ValidationUtils.validateLoginCredentials(username, password);
            } catch (validationError: unknown) {
                return sendError(res, 400, getErrorMessage(validationError));
            }
            
            const user = await this.userModel.authenticate(validatedCredentials.username, validatedCredentials.password);
            
            if (!user) {
                return sendError(res, 401, 'Invalid username or password');
            }
            
            // Store user info in session
            req.session.userId = user.id;
            req.session.user = {
                id: user.id,
                username: user.username,
                groups: user.groups,
                roles: user.roles,
                email: user.email,
                is_sso_user: user.is_sso_user
            };
            
            return sendSuccess(res, {
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    groups: user.groups,
                    roles: user.roles,
                    email: user.email,
                    is_sso_user: user.is_sso_user
                }
            });
        } catch (error: unknown) {
            console.error('Login error:', error);
            return sendError(res, 500, 'An unexpected error occurred during login', getErrorMessage(error));
        }
    }

    // SSO Login endpoint - starts OIDC flow
    async ssoLogin(req: Request, res: Response) {
        const wantsJson = req.accepts(['html', 'json']) === 'json';

        const failSso = (status: number, message: string) => {
            if (wantsJson) {
                return res.status(status).json({
                    error: 'SSO initiation failed',
                    message
                });
            }
            const params = new URLSearchParams({ sso_error: message });
            return res.redirect(`/?${params.toString()}`);
        };

        try {
            // Initialize OIDC config if needed (lazy initialization)
            const oidcConfig = await config.getOIDCConfig();
            
            if (!oidcConfig) {
                return failSso(
                    503,
                    'Error signing in with SSO. Please wait a moment and try again.'
                );
            }

            // Generate PKCE and state for security following official documentation
            const code_verifier = config.oidcLib.randomPKCECodeVerifier();
            const code_challenge = await config.oidcLib.calculatePKCECodeChallenge(code_verifier);
            const state = config.oidcLib.randomState();
            
            req.session.oidc_code_verifier = code_verifier;
            req.session.oidc_state = state;

            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            // Build authorization URL parameters
            const redirect_uri = `https://${config.dashBoardWebHostname}/api/users/sso-callback`;
            const scope = 'openid profile email groups';
            
            const parameters = {
                redirect_uri,
                scope,
                code_challenge,
                code_challenge_method: 'S256',
                state // Always include state parameter for OIDC
            };

            const redirectTo = config.oidcLib.buildAuthorizationUrl(oidcConfig, parameters);

            console.log('Redirecting to:', redirectTo.href);
            res.redirect(redirectTo.href);
        } catch (error: unknown) {
            console.error('SSO Login error:', error);
            return failSso(503, friendlySsoErrorMessage(error));
        }
    }

    // SSO Callback endpoint - handles OIDC callback
    async ssoCallback(req: Request, res: Response) {
        try {
            console.log('OIDC callback received');

            // Initialize OIDC config if needed (lazy initialization)
            const oidcConfig = await config.getOIDCConfig();
            
            if (!oidcConfig) {
                return res.status(500).json({ 
                    error: 'OIDC configuration failed to initialize',
                    message: 'Authentik may not be available. Please try again later.'
                });
            }

            if (!req.session.oidc_code_verifier || !req.session.oidc_state) {
                console.error('Missing session data for OIDC callback');
                return res.status(400).json({ error: 'Missing session data for authentication' });
            }

            // Get the current URL for token exchange
            const getCurrentUrl = () => {
                return new URL(req.originalUrl, `https://${req.get('host')}`);
            };

            // Exchange authorization code for tokens using official API
            const tokens = await config.oidcLib.authorizationCodeGrant(
                oidcConfig,
                getCurrentUrl(),
                {
                    pkceCodeVerifier: req.session.oidc_code_verifier,
                    expectedState: req.session.oidc_state,
                }
            );

            console.log('Token exchange successful');
            
            const userinfoEndpoint = oidcConfig.serverMetadata().userinfo_endpoint;
            if (!userinfoEndpoint) {
                throw new Error('OIDC UserInfo endpoint not found in server metadata');
            }

            const protectedResourceResponse = await config.oidcLib.fetchProtectedResource(
                oidcConfig,
                tokens.access_token,
                new URL(userinfoEndpoint),
                'GET'
            );
            
            const userinfo = await protectedResourceResponse.json() as unknown as SSOProfile;
            console.log('User info received for:', userinfo.preferred_username);

            // Create or update user based on SSO profile
            const user = await this.userModel.createOrUpdateSSOUser(userinfo);
            console.log('User authenticated:', user.username);

            // Synchronize username changes (renames file storage folder if needed)
            if (userinfo.sub) {
                try {
                    await this.hostApi.syncSsoUsername(userinfo.sub, user.username);
                } catch (err) {
                    console.error('Failed to sync SSO username to file shares on host API:', err);
                }
            }

            // Store user info + id_token (for RP-initiated logout) in session
            req.session.userId = user.id;
            req.session.user = {
                id: user.id,
                username: user.username,
                groups: user.groups,
                roles: user.roles,
                email: user.email,
                is_sso_user: user.is_sso_user
            };
            if (typeof tokens.id_token === 'string' && tokens.id_token) {
                req.session.oidc_id_token = tokens.id_token;
            }

            delete req.session.oidc_state;
            delete req.session.oidc_code_verifier;

            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            console.log('OIDC authentication successful for', user.username);
            return res.redirect('/');

        } catch (error: unknown) {
            console.error('OIDC callback error:', error);
            const message = friendlySsoErrorMessage(error);
            const wantsJson = req.accepts(['html', 'json']) === 'json';
            if (wantsJson) {
                return res.status(500).json({
                    error: 'Authentication failed',
                    message
                });
            }
            const params = new URLSearchParams({ sso_error: message });
            return res.redirect(`/?${params.toString()}`);
        }
    }

    // Logout endpoint
    async logout(req: Request, res: Response) {
        try {
            const user = req.session.user;
            const isSSO = !!(user && user.is_sso_user);
            const idToken = req.session.oidc_id_token;

            console.log('User logout - user data:', user);
            console.log('Is SSO user:', isSSO);

            await new Promise<void>((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            if (!isSSO) {
                return sendSuccess(res, {
                    message: 'Logout successful',
                    isSSO: false
                });
            }

            // Redirect to Authentik end-session and stay there so the
            // invalidation flow UI ("You've logged out…") is visible.
            // Do not set post_logout_redirect_uri — that would bounce
            // immediately back to the dashboard and skip Authentik's page.
            let logoutUrl: string | undefined;

            try {
                const oidcConfig = await config.getOIDCConfig();
                const endSessionUrl = oidcConfig?.serverMetadata()?.end_session_endpoint;
                if (endSessionUrl) {
                    const url = new URL(endSessionUrl);
                    if (idToken) {
                        url.searchParams.set('id_token_hint', idToken);
                    }
                    logoutUrl = url.toString();
                }
            } catch (e) {
                console.error('Failed to get dynamic end_session_endpoint for logout:', e);
            }

            if (!logoutUrl) {
                const url = new URL(
                    `https://${config.authentikWebHostname}/application/o/homelab-dashboard/end-session/`
                );
                if (idToken) {
                    url.searchParams.set('id_token_hint', idToken);
                }
                logoutUrl = url.toString();
            }

            return sendSuccess(res, {
                message: 'SSO logout initiated',
                redirect: logoutUrl,
                isSSO: true
            });
        } catch (error: unknown) {
            console.error('Logout error:', error);
            return sendError(res, 500, 'An unexpected error occurred during logout', getErrorMessage(error));
        }
    }

    // Check if this is the first user
    async checkFirstUser(req: Request, res: Response) {
        try {
            const isFirst = await this.userModel.isFirstUser();
            return sendSuccess(res, {
                isFirstUser: isFirst
            });
        } catch (error: unknown) {
            console.error('First user check error:', error);
            return sendError(res, 500, 'Failed to check first user status', getErrorMessage(error));
        }
    }

    // Get current user info
    async getMe(req: Request, res: Response) {
        try {
            const sessionUser = req.session.user || req.user;
            if (!sessionUser) {
                return sendError(res, 401, 'Not authenticated');
            }
            const user = this.userModel.getUserById(sessionUser.id);
            if (!user) {
                return sendError(res, 404, 'User not found');
            }
            return sendSuccess(res, {
                user: {
                    id: user.id,
                    username: user.username,
                    groups: user.groups,
                    roles: user.roles,
                    email: user.email,
                    is_sso_user: user.is_sso_user,
                    has_local_password: user.has_local_password
                }
            });
        } catch (error: unknown) {
            console.error('Get user error:', error);
            return sendError(res, 500, 'Failed to retrieve user information', getErrorMessage(error));
        }
    }

    // Verify session endpoint
    async verifySession(req: Request, res: Response) {
        try {
            // Check if user is logged in via session
            if (!req.session.userId || !req.session.user) {
                return sendError(res, 401, 'No valid session found');
            }
            
            const user = this.userModel.getUserById(req.session.user.id);
            if (!user) {
                return sendError(res, 404, 'User not found');
            }
            
            return sendSuccess(res, {
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    groups: user.groups,
                    roles: user.roles,
                    email: user.email,
                    is_sso_user: user.is_sso_user,
                    has_local_password: user.has_local_password
                }
            });
        } catch (error: unknown) {
            console.error('Session verification error:', error);
            return sendError(res, 500, 'Session verification failed', getErrorMessage(error));
        }
    }

    // Update user profile
    async updateProfile(req: Request, res: Response) {
        try {
            const { username, currentPassword, newPassword } = req.body;
            const userId = req.session.user?.id || req.user?.id;
            const isSSO = req.session.user?.is_sso_user || false;
            
            if (!userId) {
                return sendError(res, 401, 'Not authenticated');
            }

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const currentUsername = req.session.user?.username || req.user?.username || '';

            // SSO users cannot change username
            if (isSSO && username !== currentUsername) {
                return sendError(res, 403, 'SSO users cannot change their username');
            }
            
            // Validate input at controller level
            let validatedUsername, validatedNewPassword;
            try {
                validatedUsername = ValidationUtils.validateUsername(username);
                
                // Only validate new password if provided
                if (newPassword) {
                    validatedNewPassword = ValidationUtils.validatePassword(newPassword);
                }
            } catch (validationError: unknown) {
                return sendError(res, 400, getErrorMessage(validationError));
            }
            
            const updatedUser = await this.userModel.updateProfile(userId, validatedUsername, currentPassword, validatedNewPassword);
            
            // If the local password was updated, sync to host API!
            if (validatedNewPassword) {
                try {
                    await this.hostApi.updateFileAccountPassword(updatedUser.username, validatedNewPassword);
                } catch (err) {
                    console.error(`Failed to sync password to host API for ${updatedUser.username}:`, err);
                }
            }
            
            // Update session with new user data
            if (req.session.user) {
                req.session.user.username = updatedUser.username;
                req.session.user.groups = updatedUser.groups;
                req.session.user.roles = updatedUser.roles;
                req.session.user.email = updatedUser.email;
            }
            
            return sendSuccess(res, {
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error: unknown) {
            console.error('Profile update error:', error);
            
            // Business logic errors
            if (getErrorMessage(error) === 'User not found') {
                return sendError(res, 404, 'User account not found');
            }
            
            if (getErrorMessage(error).includes('Current password is incorrect')) {
                return sendError(res, 400, 'Current password is incorrect');
            }
            
            if (getErrorMessage(error).includes('Username is already taken')) {
                return sendError(res, 400, 'Username is already taken');
            }
            
            return sendError(res, 500, 'Failed to update profile', getErrorMessage(error));
        }
    }

    // Get all users (Admin only)
    async getAllUsers(req: Request, res: Response) {
        try {
            const users = this.userModel.getAllUsers();
            return sendSuccess(res, { users });
        } catch (error: unknown) {
            console.error('Get all users error:', error);
            return sendError(res, 500, 'Failed to retrieve users list', getErrorMessage(error));
        }
    }

    // Delete user
    async deleteUser(req: Request, res: Response) {
        try {
            const targetUserId = parseInt(req.params.id as string, 10);
            const currentUserId = req.session.user?.id || req.user?.id;
            const currentUserRoles = req.session.user?.roles || req.user?.roles || [];
            const hasUserManagement = currentUserRoles.includes('homelab-admin') || currentUserRoles.includes('dashboard-users-user');
            
            if (isNaN(targetUserId)) {
                return sendError(res, 400, 'Invalid user ID');
            }

            // A user can delete themselves, or an admin/user manager can delete any user
            if (targetUserId !== currentUserId && !hasUserManagement) {
                return sendError(res, 403, 'You do not have permission to delete this user');
            }

            // Don't allow deleting the only admin user
            const users = this.userModel.getAllUsers();
            const admins = users.filter(u => u.roles.includes('homelab-admin'));
            const targetUser = users.find(u => u.id === targetUserId);
            
            if (targetUser && targetUser.roles.includes('homelab-admin') && admins.length <= 1) {
                return sendError(res, 400, 'Cannot delete the only administrator account in the system');
            }

            const success = this.userModel.deleteUser(targetUserId);
            if (!success) {
                return sendError(res, 404, 'User not found');
            }

            // If the user deleted themselves, destroy their session
            if (targetUserId === currentUserId) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Failed to destroy session after self-deletion:', err);
                    }
                });
            }

            return sendSuccess(res, { message: 'User deleted successfully' });
        } catch (error: unknown) {
            console.error('Delete user error:', error);
            return sendError(res, 500, 'Failed to delete user', getErrorMessage(error));
        }
    }

    // ─── File-access (Samba SMB / SFTPGo WebDAV) accounts — proxied to the host API ───

    async getFileAccounts(req: Request, res: Response) {
        try {
            const users = this.userModel.getAllUsers();
            const accounts = users
                .filter(u => u.has_local_password)
                .map(u => ({ username: u.username }));
            return sendSuccess(res, { accounts });
        } catch (error: unknown) {
            console.error('Get file accounts error:', error);
            return sendError(res, 500, 'Failed to retrieve file-access accounts', getErrorMessage(error));
        }
    }

    async createFileAccount(req: Request, res: Response) {
        try {
            const { username, password } = req.body || {};
            if (!username || !password) {
                return sendError(res, 400, 'Username and password are required');
            }
            // Create user locally in database
            const localUser = await this.userModel.createLocalUser(username, password, `${username}@${config.homelabHostname || 'homelab.home.arpa'}`);
            const isAdmin = localUser?.roles?.includes('homelab-admin') || false;
            
            // Get sso_id if this username corresponds to an SSO user
            const stmt = (this.userModel as any).db.prepare('SELECT sso_id FROM users WHERE LOWER(username) = LOWER(?)');
            const row = stmt.get(username) as { sso_id?: string } | undefined;
            const ssoId = row?.sso_id || undefined;

            // Call host API to write config and sync
            await this.hostApi.createFileAccount(username, password, isAdmin, ssoId);
            return sendSuccess(res, { message: `User account "${username}" created` });
        } catch (error: unknown) {
            console.error('Create file account error:', error);
            return sendError(res, 400, friendlyHostApiError(error));
        }
    }

    async updateFileAccountPassword(req: Request, res: Response) {
        try {
            const username = req.params.username as string;
            const { password } = req.body || {};
            if (!password) {
                return sendError(res, 400, 'Password is required');
            }
            // Update user password locally in database
            await this.userModel.updateLocalPassword(username, password);
            // Retrieve target user profile from DB to determine admin status and SSO link
            const stmt = (this.userModel as any).db.prepare('SELECT roles, sso_id FROM users WHERE LOWER(username) = LOWER(?)');
            const row = stmt.get(username) as { roles: string; sso_id?: string } | undefined;
            const userRoles = row ? (JSON.parse(row.roles || '[]') as string[]) : [];
            const isAdmin = userRoles.includes('homelab-admin');
            const ssoId = row?.sso_id || undefined;

            // Call host API to write config and sync
            await this.hostApi.updateFileAccountPassword(username, password, isAdmin, ssoId);
            return sendSuccess(res, { message: `Local password updated for "${username}"` });
        } catch (error: unknown) {
            console.error('Update file account password error:', error);
            return sendError(res, 400, friendlyHostApiError(error));
        }
    }

    async deleteFileAccount(req: Request, res: Response) {
        try {
            const username = req.params.username as string;
            // Get user by username
            const stmt = (this.userModel as any).db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
            const user = stmt.get(username) as { id: number } | undefined;
            if (user) {
                this.userModel.deleteUser(user.id);
            }
            // Call host API to write env and sync
            await this.hostApi.deleteFileAccount(username);
            return sendSuccess(res, { message: `User "${username}" deleted` });
        } catch (error: unknown) {
            console.error('Delete file account error:', error);
            return sendError(res, 400, friendlyHostApiError(error));
        }
    }
}

export default UserController;
