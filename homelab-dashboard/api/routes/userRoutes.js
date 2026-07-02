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

/**
 * @openapi
 * tags:
 *   name: Users
 *   description: User authentication and profile management
 */

// Login endpoint
/**
 * @openapi
 * /api/users/login:
 *   post:
 *     summary: Local user login
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Local auth disabled
 */
router.post('/login', loginLimiter, (req, res) => userController.login(req, res));

// SSO Login endpoint
/**
 * @openapi
 * /api/users/sso-login:
 *   get:
 *     summary: Initiate SSO authentication flow
 *     tags: [Users]
 *     responses:
 *       302:
 *         description: Redirect to SSO Provider
 */
router.get('/sso-login', (req, res) => userController.ssoLogin(req, res));

// SSO Callback endpoint
/**
 * @openapi
 * /api/users/sso-callback:
 *   get:
 *     summary: SSO OIDC callback handler
 *     tags: [Users]
 *     responses:
 *       302:
 *         description: Redirect to home page upon success
 */
router.get('/sso-callback', (req, res) => userController.ssoCallback(req, res));

// Logout endpoint
/**
 * @openapi
 * /api/users/logout:
 *   post:
 *     summary: User logout
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req, res) => userController.logout(req, res));

// Check if this is the first user setup
/**
 * @openapi
 * /api/users/first-user-check:
 *   get:
 *     summary: Check if system setup is required
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Status payload
 */
router.get('/first-user-check', (req, res) => userController.checkFirstUser(req, res));

// Get current user info
/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Get current authenticated user details
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User details payload
 *       401:
 *         description: Unauthorized
 */
router.get('/me', requireAuth(), (req, res) => userController.getMe(req, res));

// Verify session endpoint
/**
 * @openapi
 * /api/users/verify:
 *   post:
 *     summary: Validate current session token
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Session validity status
 *       401:
 *         description: Invalid session
 */
router.post('/verify', (req, res) => userController.verifySession(req, res));

// Update user profile
/**
 * @openapi
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation or mismatch error
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', requireAuth(), (req, res) => userController.updateProfile(req, res));

// Get all users (Admin only)
/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get list of all users
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', requireAuth('dashboard-users-user'), (req, res) => userController.getAllUsers(req, res));

// Delete user
/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete('/:id', requireAuth(), (req, res) => userController.deleteUser(req, res));

module.exports = router;
