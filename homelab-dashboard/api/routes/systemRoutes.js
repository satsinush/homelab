const express = require('express');
const SystemController = require('../controllers/systemController');
const UserSettings = require('../models/UserSettings');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();
const systemController = new SystemController();
const userSettings = new UserSettings();

// Health check (no auth required)
router.get('/health', (req, res) => systemController.healthCheck(req, res));

// Server settings endpoints
// GET: any authenticated user can read settings (non-admins need device settings)
// PUT: admin-only — only admins can change server/system settings
router.get('/settings', requireAuth(), (req, res) => systemController.getSettings(req, res));
router.put('/settings', requireAuth('dashboard-settings-user'), (req, res) => systemController.updateSettings(req, res));

// User settings endpoints (per-user key-value store)
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
router.get('/system', requireAuth('dashboard-system-user'), (req, res) => systemController.getSystemInfo(req, res));
router.get('/packages', requireAuth('dashboard-packages-user'), (req, res) => systemController.getPackages(req, res));
router.get('/system/rustdesk-config', requireAuth('dashboard-system-user'), (req, res) => systemController.getRustDeskConfig(req, res));
router.get('/system/updates/check', requireAuth('dashboard-system-user'), (req, res) => systemController.checkUpdates(req, res));
router.get('/system/secrets', requireAuth('dashboard-secrets-user'), (req, res) => systemController.getSecrets(req, res));

module.exports = router;
