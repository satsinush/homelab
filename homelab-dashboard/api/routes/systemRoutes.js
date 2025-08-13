const express = require('express');
const SystemController = require('../controllers/systemController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const systemController = new SystemController();

// Health check (no auth required)
router.get('/health', (req, res) => systemController.healthCheck(req, res));

// Settings endpoints
router.get('/settings', requireAuth('admin'), (req, res) => systemController.getSettings(req, res));
router.put('/settings', requireAuth('admin'), (req, res) => systemController.updateSettings(req, res));

// System information endpoints
router.get('/system', requireAuth('admin'), (req, res) => systemController.getSystemInfo(req, res));
router.get('/packages', requireAuth('admin'), (req, res) => systemController.getPackages(req, res));

module.exports = router;
