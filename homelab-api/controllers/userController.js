const User = require('../models/User');
const ValidationUtils = require('../utils/validation');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class UserController {
    constructor() {
        this.userModel = new User();
    }

    // Login endpoint
    async login(req, res) {
        try {
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
            
            const tokenData = this.userModel.createToken(user.id);
            
            if (!tokenData) {
                return sendError(res, 500, 'Failed to create authentication token');
            }
            
            // Store token in session
            req.session.token = tokenData.token;
            req.session.userId = user.id;
            
            return sendSuccess(res, {
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    roles: user.roles
                },
                token: tokenData.token,
                expiresAt: tokenData.expiresAt
            });
        } catch (error) {
            console.error('Login error:', error);
            return sendError(res, 500, 'An unexpected error occurred during login', error.message);
        }
    }

    // Logout endpoint
    async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    return sendError(res, 500, 'Failed to logout properly');
                }
                sendSuccess(res, { message: 'Logout successful' });
            });
        } catch (error) {
            console.error('Logout error:', error);
            return sendError(res, 500, 'An unexpected error occurred during logout', error.message);
        }
    }

    // Get current user info
    async getMe(req, res) {
        try {
            return sendSuccess(res, {
                user: {
                    id: req.user.userId,
                    username: req.user.username,
                    roles: req.user.roles
                }
            });
        } catch (error) {
            console.error('Get user error:', error);
            return sendError(res, 500, 'Failed to retrieve user information', error.message);
        }
    }

    // Verify token endpoint
    async verifyToken(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
            
            if (!token) {
                return sendError(res, 401, 'Authentication token is required');
            }
            
            const user = this.userModel.verifyToken(token);
            
            if (!user) {
                return sendError(res, 401, 'Invalid or expired authentication token');
            }
            
            return sendSuccess(res, {
                valid: true,
                user: {
                    id: user.userId,
                    username: user.username,
                    roles: user.roles
                }
            });
        } catch (error) {
            console.error('Token verification error:', error);
            return sendError(res, 500, 'Token verification failed', error.message);
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { username, currentPassword, newPassword } = req.body;
            const userId = req.user.userId;
            
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }
            
            // Validate input at controller level
            let validatedUsername, validatedNewPassword;
            try {
                validatedUsername = ValidationUtils.validateUsername(username);
                
                // Only validate new password if provided
                if (newPassword) {
                    validatedNewPassword = ValidationUtils.validatePassword(newPassword);
                }
                
                // Current password validation (if changing password)
                if (newPassword && !currentPassword) {
                    throw new Error('Current password is required to change password');
                }
                
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }
            
            const updatedUser = await this.userModel.updateProfile(userId, validatedUsername, currentPassword, validatedNewPassword);
            
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
}

module.exports = UserController;
