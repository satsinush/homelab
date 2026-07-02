const express = require('express');
const DeviceController = require('../controllers/deviceController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const deviceController = new DeviceController();

// Device endpoints
router.get('/devices', requireAuth('dashboard-devices-user'), (req, res) => deviceController.getDevices(req, res));
router.post('/devices/scan', requireAuth('dashboard-devices-user'), (req, res) => deviceController.scanDevices(req, res));
router.post('/devices/clear-cache', requireAuth('dashboard-devices-user'), (req, res) => deviceController.clearDeviceCache(req, res));
router.post('/devices', requireAuth('dashboard-devices-user'), (req, res) => deviceController.createDevice(req, res));
router.put('/devices/:mac', requireAuth('dashboard-devices-user'), (req, res) => deviceController.updateDevice(req, res));
router.post('/devices/:mac/favorite', requireAuth('dashboard-devices-user'), (req, res) => deviceController.toggleFavorite(req, res));

// Wake-on-LAN endpoint
router.post('/wol', requireAuth('dashboard-devices-user'), (req, res) => deviceController.sendWakeOnLan(req, res));

module.exports = router;
