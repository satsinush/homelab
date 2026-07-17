import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import UserController from '../controllers/userController';
import { requireAuth } from '../middleware/authMiddleware';
import config from '../config';

const router = express.Router();
const userController = new UserController();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
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
router.post('/login', loginLimiter, (req: Request, res: Response) => userController.login(req, res));

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
router.get('/sso-login', (req: Request, res: Response) => userController.ssoLogin(req, res));

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
router.get('/sso-callback', (req: Request, res: Response) => userController.ssoCallback(req, res));

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
router.post('/logout', (req: Request, res: Response) => userController.logout(req, res));

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
router.get('/first-user-check', (req: Request, res: Response) => userController.checkFirstUser(req, res));

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
router.get('/me', requireAuth(), (req: Request, res: Response) => userController.getMe(req, res));

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
router.post('/verify', (req: Request, res: Response) => userController.verifySession(req, res));

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
router.put('/profile', requireAuth(), (req: Request, res: Response) => userController.updateProfile(req, res));

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
router.get('/', requireAuth('dashboard-users-user'), (req: Request, res: Response) => userController.getAllUsers(req, res));

// File-access (Samba/WebDAV) accounts
/**
 * @openapi
 * /api/users/file-accounts:
 *   get:
 *     summary: List Samba/WebDAV file-access accounts
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Accounts list (no passwords)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   post:
 *     summary: Create a file-access account (recreates samba/sftpgo)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account created
 *       400:
 *         description: Validation error or duplicate account
 */
router.get('/file-accounts', requireAuth('dashboard-users-user'), (req: Request, res: Response) => userController.getFileAccounts(req, res));
router.post('/file-accounts', requireAuth('dashboard-users-user'), (req: Request, res: Response) => userController.createFileAccount(req, res));

/**
 * @openapi
 * /api/users/file-accounts/{username}/password:
 *   put:
 *     summary: Reset a file-access account password (recreates samba/sftpgo)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Validation error
 */
router.put('/file-accounts/:username/password', requireAuth('dashboard-users-user'), (req: Request, res: Response) => userController.updateFileAccountPassword(req, res));

/**
 * @openapi
 * /api/users/file-accounts/{username}:
 *   delete:
 *     summary: Delete a file-access account (home files kept; recreates samba/sftpgo)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account deleted
 *       400:
 *         description: Unknown account
 */
router.delete('/file-accounts/:username', requireAuth('dashboard-users-user'), (req: Request, res: Response) => userController.deleteFileAccount(req, res));

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
router.delete('/:id', requireAuth(), (req: Request, res: Response) => userController.deleteUser(req, res));

export default router;
