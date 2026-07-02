const express = require('express');
const SystemController = require('../controllers/systemController');
const UserSettings = require('../models/UserSettings');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();
const systemController = new SystemController();
const userSettings = new UserSettings();

/**
 * @openapi
 * tags:
 *   name: System
 *   description: System health, settings, and host package management
 */

// Health check (no auth required)
/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Verify api status and active health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/health', (req, res) => systemController.healthCheck(req, res));

// Server settings endpoints
/**
 * @openapi
 * /api/settings:
 *   get:
 *     summary: Get dashboard preference settings
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard settings payload
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update global dashboard settings (Admin Only)
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/settings', requireAuth(), (req, res) => systemController.getSettings(req, res));
router.put('/settings', requireAuth('dashboard-settings-user'), (req, res) => systemController.updateSettings(req, res));

// User settings endpoints (per-user key-value store)
/**
 * @openapi
 * /api/user-settings:
 *   get:
 *     summary: Retrieve current user preferences
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Preference store values
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Save user preferences
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated preferences payload
 *       401:
 *         description: Unauthorized
 */
router.get('/user-settings', requireAuth(), (req, res) => {
    try {
        const settings = userSettings.get(req.user.id);
        return sendSuccess(res, { settings, defaults: userSettings.getDefaults() });
    } catch (error) {
        return sendError(res, 500, 'Failed to load user settings', error.message);
    }
});

router.put('/user-settings', requireAuth(), (req, res) => {
    try {
        const updated = userSettings.setAll(req.user.id, req.body);
        return sendSuccess(res, { settings: updated });
    } catch (error) {
        return sendError(res, 500, 'Failed to save user settings', error.message);
    }
});

// System information endpoints
/**
 * @openapi
 * /api/system:
 *   get:
 *     summary: Get host system specs and metrics
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: System metrics JSON payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/system', requireAuth('dashboard-system-user'), (req, res) => systemController.getSystemInfo(req, res));

/**
 * @openapi
 * /api/packages:
 *   get:
 *     summary: Get lists of installed packages and pending updates
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Packages object list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/packages', requireAuth('dashboard-packages-user'), (req, res) => systemController.getPackages(req, res));

/**
 * @openapi
 * /api/system/rustdesk-config:
 *   get:
 *     summary: Get RustDesk configuration details
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: RustDesk settings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/system/rustdesk-config', requireAuth('dashboard-system-user'), (req, res) => systemController.getRustDeskConfig(req, res));

/**
 * @openapi
 * /api/system/updates/check:
 *   get:
 *     summary: Trigger manual update check of host OS packages
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Success flag
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/system/updates/check', requireAuth('dashboard-system-user'), (req, res) => systemController.checkUpdates(req, res));

/**
 * @openapi
 * /api/system/secrets:
 *   get:
 *     summary: Get lists of secrets in run/secrets (Admin Only)
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Secrets list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/system/secrets', requireAuth('dashboard-secrets-user'), (req, res) => systemController.getSecrets(req, res));

module.exports = router;
