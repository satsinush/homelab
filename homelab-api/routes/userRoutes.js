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
});

// Login endpoint
router.post('/login', loginLimiter, (req, res) => userController.login(req, res));

// Logout endpoint
router.post('/logout', (req, res) => userController.logout(req, res));

// Get current user info
router.get('/me', requireAuth(), (req, res) => userController.getMe(req, res));

// Verify token endpoint
router.post('/verify', (req, res) => userController.verifyToken(req, res));

// Update user profile
router.put('/profile', requireAuth(), (req, res) => userController.updateProfile(req, res));

module.exports = router;
