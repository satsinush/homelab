const User = require('../models/User');
const ValidationUtils = require('../utils/validation');

class UserController {
    constructor() {
        this.userModel = new User();
    }

    // Login endpoint
    async login(req, res) {
        try {
            const { username, password } = req.body;
            
            // Validate input at controller level
            let validatedCredentials;
            try {
                validatedCredentials = ValidationUtils.validateLoginCredentials(username, password);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
            
            const user = await this.userModel.authenticate(validatedCredentials.username, validatedCredentials.password);
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const tokenData = this.userModel.createToken(user.id);
            
            if (!tokenData) {
                return res.status(500).json({ error: 'Failed to create token' });
            }
            
            // Store token in session
            req.session.token = tokenData.token;
            req.session.userId = user.id;
            
            res.json({
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
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Logout endpoint
    async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    return res.status(500).json({ error: 'Failed to logout' });
                }
                res.json({ message: 'Logout successful' });
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get current user info
    async getMe(req, res) {
        try {
            res.json({
                user: {
                    id: req.user.userId,
                    username: req.user.username,
                    roles: req.user.roles
                }
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Verify token endpoint
    async verifyToken(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
            
            if (!token) {
                return res.status(401).json({ error: 'No token provided' });
            }
            
            const user = this.userModel.verifyToken(token);
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            
            res.json({
                valid: true,
                user: {
                    id: user.userId,
                    username: user.username,
                    roles: user.roles
                }
            });
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { username, currentPassword, newPassword } = req.body;
            const userId = req.user.userId;
            
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
                return res.status(400).json({ error: validationError.message });
            }
            
            const updatedUser = await this.userModel.updateProfile(userId, validatedUsername, currentPassword, validatedNewPassword);
            
            res.json({
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Profile update error:', error);
            
            // Business logic errors
            if (error.message === 'User not found') {
                return res.status(404).json({ error: error.message });
            }
            
            if (error.message.includes('Current password is incorrect') ||
                error.message.includes('Username is already taken')) {
                return res.status(400).json({ error: error.message });
            }
            
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = UserController;
