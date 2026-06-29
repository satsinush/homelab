const User = require('../models/User');
const ValidationUtils = require('../utils/validation');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses
const config = require('../config');
const client = require('openid-client');

class UserController {
    constructor() {
        this.userModel = new User();
    }

    // Login endpoint
    async login(req, res) {
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
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
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
                email: user.email,
                is_sso_user: user.is_sso_user
            };
            
            return sendSuccess(res, {
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    groups: user.groups,
                    email: user.email,
                    is_sso_user: user.is_sso_user
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            return sendError(res, 500, 'An unexpected error occurred during login', error.message);
        }
    }

    // SSO Login endpoint - starts OIDC flow
    async ssoLogin(req, res) {
        try {
            // Initialize OIDC config if needed (lazy initialization)
            const oidcConfig = await config.getOIDCConfig();
            
            if (!oidcConfig) {
                return res.status(500).json({ 
                    error: 'OIDC configuration failed to initialize',
                    message: 'Authentik may not be available. Please try again later.'
                });
            }

            // Generate PKCE and state for security following official documentation
            const code_verifier = client.randomPKCECodeVerifier();
            const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
            const state = client.randomState();
            
            // Store in session for verification
            req.session.oidc_code_verifier = code_verifier;
            req.session.oidc_state = state;

            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            // Build authorization URL parameters
            const redirect_uri = `https://${process.env.DASHBOARD_WEB_HOSTNAME}/api/users/sso-callback`;
            const scope = 'openid profile email groups';
            
            const parameters = {
                redirect_uri,
                scope,
                code_challenge,
                code_challenge_method: 'S256',
                state // Always include state parameter for OIDC
            };

            const redirectTo = client.buildAuthorizationUrl(oidcConfig, parameters);

            console.log('Redirecting to:', redirectTo.href);
            res.redirect(redirectTo.href);
            
        } catch (error) {
            console.error('SSO Login error:', error);
            if (error.message && error.message.includes('discovery')) {
                return res.status(503).json({ 
                    error: 'SSO service unavailable',
                    message: 'Authentik is not available. Please try local login or try again later.'
                });
            }
            res.status(500).json({ error: 'Failed to initiate SSO login' });
        }
    }

    // SSO Callback endpoint - handles OIDC callback
    async ssoCallback(req, res) {
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

            // Verify we have the required session data
            if (!req.session.oidc_code_verifier || !req.session.oidc_state) {
                console.error('Missing session data for OIDC callback');
                return res.status(400).json({ error: 'Missing session data for authentication' });
            }

            // Get the current URL for token exchange
            const getCurrentUrl = () => {
                return new URL(req.originalUrl, `https://${req.get('host')}`);
            };

            // Exchange authorization code for tokens using official API
            const tokens = await client.authorizationCodeGrant(
                oidcConfig,
                getCurrentUrl(),
                {
                    pkceCodeVerifier: req.session.oidc_code_verifier,
                    expectedState: req.session.oidc_state,
                }
            );

            console.log('Token exchange successful');
            
            // Get user info using the access token and dynamic endpoint from discovery
            const userinfoEndpoint = oidcConfig.serverMetadata().userinfo_endpoint;
            const protectedResourceResponse = await client.fetchProtectedResource(
                oidcConfig,
                tokens.access_token,
                new URL(userinfoEndpoint),
                'GET'
            );
            
            const userinfo = await protectedResourceResponse.json();
            console.log('User info received for:', userinfo.preferred_username);

            // Create or update user based on SSO profile
            const user = await this.userModel.createOrUpdateSSOUser(userinfo);
            console.log('User authenticated:', user.username);

            // Store user info in session
            req.session.userId = user.id;
            req.session.user = {
                id: user.id,
                username: user.username,
                groups: user.groups,
                email: user.email,
                is_sso_user: user.is_sso_user
            };

            // Clean up OIDC session data
            delete req.session.oidc_state;
            delete req.session.oidc_code_verifier;

            await new Promise((resolve, reject) => {
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

        } catch (error) {
            console.error('OIDC callback error:', error);
            return res.status(500).json({
                error: 'Authentication failed',
                details: error.message
            });
        }
    }

    // Logout endpoint
    async logout(req, res) {
        try {
            const user = req.session.user;
            const isSSO = user && user.is_sso_user;
            
            console.log('User logout - user data:', user);
            console.log('Is SSO user:', isSSO);
            
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    return sendError(res, 500, 'Failed to logout properly');
                }
                
                // If user was authenticated via SSO, return redirect URL for frontend to handle
                if (isSSO) {
                    console.log('SSO user logout - returning redirect URL');
                    const APP_URL = `https://${process.env.DASHBOARD_WEB_HOSTNAME}`;
                    
                    (async () => {
                        let logoutUrl;
                        try {
                            const oidcConfig = await config.getOIDCConfig();
                            const endSessionUrl = oidcConfig?.serverMetadata()?.end_session_endpoint;
                            if (endSessionUrl) {
                                logoutUrl = `${endSessionUrl}?post_logout_redirect_uri=${encodeURIComponent(APP_URL)}`;
                            }
                        } catch (e) {
                            console.error('Failed to get dynamic end_session_endpoint for logout:', e);
                        }
                        if (!logoutUrl) {
                            logoutUrl = `https://${process.env.AUTHENTIK_WEB_HOSTNAME}/application/o/homelab-dashboard/end-session/?post_logout_redirect_uri=${encodeURIComponent(APP_URL)}`;
                        }
                        
                        return sendSuccess(res, { 
                            message: 'SSO logout initiated',
                            redirect: logoutUrl,
                            isSSO: true
                        });
                    })();
                } else {
                    // Local user, send JSON response for API clients
                    console.log('Local user logout - sending success response');
                    sendSuccess(res, { 
                        message: 'Logout successful',
                        isSSO: false
                    });
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
            return sendError(res, 500, 'An unexpected error occurred during logout', error.message);
        }
    }

    // Check if this is the first user
    async checkFirstUser(req, res) {
        try {
            const isFirst = await this.userModel.isFirstUser();
            return sendSuccess(res, {
                isFirstUser: isFirst
            });
        } catch (error) {
            console.error('First user check error:', error);
            return sendError(res, 500, 'Failed to check first user status', error.message);
        }
    }

    // Get current user info
    async getMe(req, res) {
        try {
            const user = req.session.user || req.user;
            return sendSuccess(res, {
                user: {
                    id: user.id,
                    username: user.username,
                    groups: user.groups,
                    email: user.email,
                    is_sso_user: user.is_sso_user
                }
            });
        } catch (error) {
            console.error('Get user error:', error);
            return sendError(res, 500, 'Failed to retrieve user information', error.message);
        }
    }

    // Verify session endpoint
    async verifySession(req, res) {
        try {
            // Check if user is logged in via session
            if (!req.session.userId || !req.session.user) {
                return sendError(res, 401, 'No valid session found');
            }
            
            return sendSuccess(res, {
                valid: true,
                user: {
                    id: req.session.user.id,
                    username: req.session.user.username,
                    groups: req.session.user.groups,
                    email: req.session.user.email,
                    is_sso_user: req.session.user.is_sso_user
                }
            });
        } catch (error) {
            console.error('Session verification error:', error);
            return sendError(res, 500, 'Session verification failed', error.message);
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { username, currentPassword, newPassword } = req.body;
            const userId = req.session.user?.id || req.user?.id;
            const isSSO = req.session.user?.is_sso_user || false;
            
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // SSO users cannot change username or password
            if (isSSO && username !== req.session.user.username) {
                return sendError(res, 403, 'SSO users cannot change their username');
            }
            
            if (isSSO && newPassword) {
                return sendError(res, 403, 'SSO users cannot change their password. Please use your SSO provider.');
            }
            
            // Validate input at controller level
            let validatedUsername, validatedNewPassword;
            try {
                validatedUsername = ValidationUtils.validateUsername(username);
                
                // Only validate new password if provided
                if (newPassword) {
                    validatedNewPassword = ValidationUtils.validatePassword(newPassword);
                }
                
                // Current password required for any change (username or password)
                const isUsernameChanging = validatedUsername !== req.session.user.username;
                if (!isSSO && (isUsernameChanging || newPassword) && !currentPassword) {
                    throw new Error('Current password is required to make changes');
                }
                
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }
            
            const updatedUser = await this.userModel.updateProfile(userId, validatedUsername, currentPassword, validatedNewPassword);
            
            // Update session with new user data
            if (req.session.user) {
                req.session.user.username = updatedUser.username;
                req.session.user.groups = updatedUser.groups;
                req.session.user.email = updatedUser.email;
            }
            
            return sendSuccess(res, {
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Profile update error:', error);
            
            // Business logic errors
            if (error.message === 'User not found') {
                return sendError(res, 404, 'User account not found');
            }
            
            if (error.message.includes('Current password is incorrect')) {
                return sendError(res, 400, 'Current password is incorrect');
            }
            
            if (error.message.includes('Username is already taken')) {
                return sendError(res, 400, 'Username is already taken');
            }
            
            return sendError(res, 500, 'Failed to update profile', error.message);
        }
    }

    // Get all users (Admin only)
    async getAllUsers(req, res) {
        try {
            const users = this.userModel.getAllUsers();
            return sendSuccess(res, { users });
        } catch (error) {
            console.error('Get all users error:', error);
            return sendError(res, 500, 'Failed to retrieve users list', error.message);
        }
    }

    // Delete user
    async deleteUser(req, res) {
        try {
            const targetUserId = parseInt(req.params.id, 10);
            const currentUserId = req.session.user?.id || req.user?.id;
            const currentUserGroups = req.session.user?.groups || req.user?.groups || [];
            const isAdmin = currentUserGroups.includes('admin');
            
            if (isNaN(targetUserId)) {
                return sendError(res, 400, 'Invalid user ID');
            }

            // A user can delete themselves, or an admin can delete any user
            if (targetUserId !== currentUserId && !isAdmin) {
                return sendError(res, 403, 'You do not have permission to delete this user');
            }

            // Don't allow deleting the only admin user
            const users = this.userModel.getAllUsers();
            const admins = users.filter(u => u.groups.includes('admin'));
            const targetUser = users.find(u => u.id === targetUserId);
            
            if (targetUser && targetUser.groups.includes('admin') && admins.length <= 1) {
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
        } catch (error) {
            console.error('Delete user error:', error);
            return sendError(res, 500, 'Failed to delete user', error.message);
        }
    }
}

module.exports = UserController;
