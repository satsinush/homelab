import express, { Request, Response } from 'express';
import DeviceController from '../controllers/deviceController';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();
const deviceController = new DeviceController();

/**
 * @openapi
 * tags:
 *   name: Devices
 *   description: Network devices management and Wake-on-LAN control
 */

// Device endpoints
/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: Retrieve scanned network devices
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Devices list payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/devices', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.getDevices(req, res));

/**
 * @openapi
 * /api/devices/favorites:
 *   get:
 *     summary: List favorite devices for the current user (no network scan)
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Favorite devices
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/devices/favorites', requireAuth('dashboard-devices-user'), (req: Request, res: Response) =>
    deviceController.getFavoriteDevices(req, res)
);

/**
 * @openapi
 * /api/devices/scan:
 *   post:
 *     summary: Trigger network scan for online hosts
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Scan status details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/devices/scan', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.scanDevices(req, res));

/**
 * @openapi
 * /api/devices/clear-cache:
 *   post:
 *     summary: Clear saved device scan results cache
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/devices/clear-cache', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.clearDeviceCache(req, res));

/**
 * @openapi
 * /api/devices:
 *   post:
 *     summary: Register a new device manually
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - mac
 *             properties:
 *               name:
 *                 type: string
 *               mac:
 *                 type: string
 *               ip:
 *                 type: string
 *     responses:
 *       201:
 *         description: Device registered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/devices', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.createDevice(req, res));

/**
 * @openapi
 * /api/devices/{mac}:
 *   put:
 *     summary: Update device registration properties
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mac
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Device updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/devices/:mac', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.updateDevice(req, res));

/**
 * @openapi
 * /api/devices/{mac}/favorite:
 *   post:
 *     summary: Toggle favorite flag on device
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mac
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorite state updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/devices/:mac/favorite', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.toggleFavorite(req, res));

// Wake-on-LAN endpoint
/**
 * @openapi
 * /api/wol:
 *   post:
 *     summary: Send Wake-on-LAN magic packet to device MAC
 *     tags: [Devices]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mac
 *             properties:
 *               mac:
 *                 type: string
 *     responses:
 *       200:
 *         description: Magic packet sent
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/wol', requireAuth('dashboard-devices-user'), (req: Request, res: Response) => deviceController.sendWakeOnLan(req, res));

export default router;
