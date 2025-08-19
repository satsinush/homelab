const express = require('express');
const rateLimit = require('express-rate-limit');
const UserController = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const config = require('../config');

const router = express.Router();
const userController = new UserController();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests to avoid penalizing users unnecessarily
    skipSuccessfulRequests: true,
    // Use a more specific key generator that includes user agent for better tracking
    keyGenerator: (req) => {
        return req.ip + ':' + (req.get('User-Agent') || 'unknown').substring(0, 50);
    }
});

// Login endpoint
router.post('/login', loginLimiter, (req, res) => userController.login(req, res));

// SSO Login endpoint
router.get('/sso-login', (req, res) => userController.ssoLogin(req, res));

// SSO Callback endpoint
router.get('/sso-callback', (req, res) => userController.ssoCallback(req, res));

// Logout endpoint
router.post('/logout', (req, res) => userController.logout(req, res));

// Check if this is the first user setup
router.get('/first-user-check', (req, res) => userController.checkFirstUser(req, res));

// Get current user info
router.get('/me', requireAuth(), (req, res) => userController.getMe(req, res));

// Verify session endpoint
router.post('/verify', (req, res) => userController.verifySession(req, res));

// Update user profile
router.put('/profile', requireAuth(), (req, res) => userController.updateProfile(req, res));

module.exports = router;
