const Device = require('../models/Device');
const Settings = require('../models/Settings');
const ValidationUtils = require('../utils/validation');
const HostApiService = require('../services/hostApiService');
const { sendError, sendSuccess } = require('../utils/response');

class DeviceController {
    constructor() {
        this.deviceModel = new Device();
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();

        // Shared network discovery cache — device presence on the LAN is not per-user.
        // Keys are MAC addresses, values are lightweight scan objects.
        this.scanCache = {
            byMac: new Map(), // mac -> { mac, ip, status, lastSeen, scanMethod }
            lastScan: null,
            scanInProgress: false
        };
    }

    // ─── Network Scan ──────────────────────────────────────────────────────────

    async performNetworkScan() {
        try {
            const scanResult = await this.hostApi.scanNetwork(this.settingsModel.getScanTimeout());
            if (!scanResult.success || !scanResult.data?.devices) {
                console.error('Network scan failed from host API');
                return [];
            }

            const now = new Date().toISOString();
            return scanResult.data.devices.map(device => ({
                mac: ValidationUtils.validateAndNormalizeMac(device.mac),
                ip: device.ip,
                status: 'online',
                lastSeen: now,
                scanMethod: 'network-scan'
            }));
        } catch (error) {
            console.error('Network scan error:', error.message);
            return [];
        }
    }

    async runScan() {
        if (this.scanCache.scanInProgress) {
            console.log('Scan already in progress...');
            return;
        }

        this.scanCache.scanInProgress = true;
        console.log('Starting device scan...');

        try {
            const scannedDevices = await this.performNetworkScan();
            const now = new Date().toISOString();

            // Get the set of MACs found in this scan
            const scannedMacSet = new Set(scannedDevices.map(d => d.mac));

            // Update the shared scan cache
            this.scanCache.byMac = new Map(scannedDevices.map(d => [d.mac, d]));

            // Propagate online/offline status to ALL users' saved records
            for (const d of scannedDevices) {
                this.deviceModel.updateScanDataForMac(d.mac, d.ip, 'online', now);
            }

            // Mark any saved MACs not found in this scan as offline
            const allSavedMacs = this.deviceModel.getAllSavedMacs();
            const offlineMacs = allSavedMacs.filter(mac => !scannedMacSet.has(mac));
            this.deviceModel.markOfflineByMacs(offlineMacs);

            this.scanCache.lastScan = Date.now();
            console.log(`Scan complete: ${scannedDevices.length} online, ${offlineMacs.length} saved devices now offline`);
        } catch (error) {
            console.error('Scan error:', error);
        } finally {
            this.scanCache.scanInProgress = false;
        }
    }

    // ─── Cache helpers ─────────────────────────────────────────────────────────

    async ensureFreshScan() {
        const cacheExpired = !this.scanCache.lastScan ||
            (Date.now() - this.scanCache.lastScan) > this.settingsModel.getCacheTimeout();
        if (cacheExpired || this.scanCache.byMac.size === 0) {
            await this.runScan();
        }
    }

    // Build the merged device list for a specific user:
    //   - Their saved records (favorites + non-favorites) with up-to-date status from DB
    //   - Any discovered devices from the scan cache not yet in the user's list
    buildDeviceListForUser(userId) {
        const userSaved = this.deviceModel.getAllForUser(userId);
        const userSavedMacs = new Set(userSaved.map(d => d.mac));

        // Merge: start with user's saved devices (they already have updated scan status)
        const result = userSaved.map(d => ({ ...d }));

        // Append discovered devices the user hasn't saved yet
        for (const [mac, scanEntry] of this.scanCache.byMac) {
            if (!userSavedMacs.has(mac)) {
                result.push({
                    mac,
                    ip: scanEntry.ip,
                    status: scanEntry.status,
                    lastSeen: scanEntry.lastSeen,
                    scanMethod: scanEntry.scanMethod,
                    isFavorite: false,
                    name: null,
                    description: null,
                    rustdeskId: null
                });
            }
        }

        return result;
    }

    // ─── HTTP Endpoints ────────────────────────────────────────────────────────

    // GET /api/devices
    async getDevices(req, res) {
        try {
            await this.ensureFreshScan();
            const userId = req.user.id;
            const devices = this.buildDeviceListForUser(userId);

            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;

            return sendSuccess(res, {
                devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: devices.length - favoriteCount,
                onlineDevices: onlineCount,
                lastScan: this.scanCache.lastScan ? new Date(this.scanCache.lastScan).toISOString() : null,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Get devices error:', error);
            return sendError(res, 500, 'Failed to retrieve devices', error.message);
        }
    }

    // POST /api/devices/scan
    async scanDevices(req, res) {
        try {
            await this.runScan();
            const userId = req.user.id;
            const devices = this.buildDeviceListForUser(userId);

            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;

            return sendSuccess(res, {
                message: 'Network scan completed successfully',
                devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: devices.length - favoriteCount,
                onlineDevices: onlineCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Scan devices error:', error);
            return sendError(res, 500, 'Failed to scan network for devices', error.message);
        }
    }

    // POST /api/devices/clear-cache
    async clearDeviceCache(req, res) {
        try {
            const userId = req.user.id;

            // Clear this user's non-favorite device rows
            const deletedCount = this.deviceModel.clearNonFavoritesForUser(userId);

            // Reset scan cache and re-run
            this.scanCache.byMac = new Map();
            this.scanCache.lastScan = null;
            await this.runScan();

            const devices = this.buildDeviceListForUser(userId);
            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;

            return sendSuccess(res, {
                message: 'Device cache cleared and network rescanned successfully',
                devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: devices.length - favoriteCount,
                onlineDevices: onlineCount,
                deletedCount,
                timestamp: new Date().toISOString(),
                cacheCleared: true
            });
        } catch (error) {
            console.error('Clear cache error:', error);
            return sendError(res, 500, 'Failed to clear device cache', error.message);
        }
    }

    // POST /api/devices — create / manually add a saved device
    async createDevice(req, res) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { name, mac, description, rustdeskId } = req.body;
            const userId = req.user.id;

            let validatedName, validatedMac, validatedDescription;
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }

            // Check if this user already has a record for this MAC
            const existing = this.deviceModel.findByMacForUser(userId, validatedMac);
            if (existing) {
                return sendError(res, 409, `You already have a device with MAC address ${validatedMac}`);
            }

            // Check scan cache for current status
            const scanEntry = this.scanCache.byMac.get(validatedMac);

            const newDevice = {
                mac: validatedMac,
                name: validatedName,
                description: validatedDescription,
                rustdeskId: rustdeskId?.replace(/\s+/g, '') || '',
                isFavorite: true,
                ip: scanEntry?.ip || null,
                status: scanEntry?.status || 'offline',
                lastSeen: scanEntry?.lastSeen || null
            };

            this.deviceModel.saveForUser(userId, newDevice);

            console.log(`Device created for user ${userId}: ${newDevice.name} (${newDevice.mac})`);

            return sendSuccess(res, {
                message: 'Device created successfully',
                device: newDevice
            }, 201);
        } catch (error) {
            console.error('Add device error:', error);
            return sendError(res, 500, 'Failed to create device', error.message);
        }
    }

    // PUT /api/devices/:mac — update a user's saved device
    async updateDevice(req, res) {
        try {
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { mac: paramMac } = req.params;
            const { name, mac, description, rustdeskId } = req.body;
            const userId = req.user.id;

            if (!paramMac?.trim()) {
                return sendError(res, 400, 'MAC address parameter is required');
            }

            let validatedName, validatedMac, validatedParamMac, validatedDescription;
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
                validatedParamMac = ValidationUtils.validateAndNormalizeMac(paramMac.trim());
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }

            // Verify this user owns a record for the old MAC
            const existingDevice = this.deviceModel.findByMacForUser(userId, validatedParamMac);
            if (!existingDevice) {
                return sendError(res, 404, 'Device not found');
            }

            // MAC address is changing
            if (validatedParamMac !== validatedMac) {
                // Make sure user doesn't already have a record for the new MAC
                const conflict = this.deviceModel.findByMacForUser(userId, validatedMac);
                if (conflict) {
                    return sendError(res, 409, `You already have a device with MAC address ${validatedMac}`);
                }

                // Delete old record, insert new one (preserving scan status)
                const scanEntry = this.scanCache.byMac.get(validatedMac);
                const updatedDevice = {
                    mac: validatedMac,
                    name: validatedName,
                    description: validatedDescription,
                    rustdeskId: rustdeskId?.replace(/\s+/g, '') || '',
                    isFavorite: existingDevice.isFavorite,
                    ip: scanEntry?.ip || existingDevice.ip,
                    status: scanEntry?.status || existingDevice.status,
                    lastSeen: scanEntry?.lastSeen || existingDevice.lastSeen
                };
                this.deviceModel.deleteForUser(userId, validatedParamMac);
                this.deviceModel.saveForUser(userId, updatedDevice);

                console.log(`Device MAC changed for user ${userId}: ${validatedParamMac} → ${validatedMac}`);

                return sendSuccess(res, {
                    message: 'Device updated successfully',
                    device: { ...updatedDevice, isFavorite: existingDevice.isFavorite }
                });
            } else {
                // MAC unchanged — just update metadata
                const updatedDevice = {
                    ...existingDevice,
                    name: validatedName,
                    description: validatedDescription,
                    rustdeskId: rustdeskId?.replace(/\s+/g, '') || ''
                };
                this.deviceModel.saveForUser(userId, updatedDevice);

                console.log(`Device updated for user ${userId}: ${updatedDevice.name} (${updatedDevice.mac})`);

                return sendSuccess(res, {
                    message: 'Device updated successfully',
                    device: updatedDevice
                });
            }
        } catch (error) {
            console.error('Update device error:', error);
            return sendError(res, 500, 'Failed to update device', error.message);
        }
    }

    // POST /api/devices/:mac/favorite — toggle favorite
    async toggleFavorite(req, res) {
        try {
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }

            const { mac } = req.params;
            if (!mac?.trim()) {
                return sendError(res, 400, 'MAC address is required');
            }

            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(mac.trim());
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }

            const userId = req.user.id;
            await this.ensureFreshScan();

            const existingRecord = this.deviceModel.findByMacForUser(userId, normalizedMac);
            const currentlyFavorite = existingRecord?.isFavorite ?? false;
            const nowFavorite = !currentlyFavorite;

            if (nowFavorite) {
                // Adding to favorites — ensure a user_devices row exists
                if (!existingRecord) {
                    // Pull live data from scan cache or use defaults
                    const scanEntry = this.scanCache.byMac.get(normalizedMac);
                    const newRecord = {
                        mac: normalizedMac,
                        name: scanEntry ? `Device-${normalizedMac.slice(-4)}` : null,
                        description: '',
                        rustdeskId: '',
                        isFavorite: true,
                        ip: scanEntry?.ip || null,
                        status: scanEntry?.status || 'offline',
                        lastSeen: scanEntry?.lastSeen || null
                    };
                    this.deviceModel.saveForUser(userId, newRecord);
                    console.log(`Device favorited for user ${userId}: ${normalizedMac}`);
                    return sendSuccess(res, {
                        message: 'Device marked as favorite',
                        device: { ...newRecord, isFavorite: true }
                    });
                } else {
                    this.deviceModel.setFavoriteForUser(userId, normalizedMac, true);
                    console.log(`Device re-favorited for user ${userId}: ${existingRecord.name || normalizedMac}`);
                    return sendSuccess(res, {
                        message: 'Device marked as favorite',
                        device: { ...existingRecord, isFavorite: true }
                    });
                }
            } else {
                // Removing from favorites — delete the user's record entirely
                this.deviceModel.deleteForUser(userId, normalizedMac);
                console.log(`Device removed from favorites for user ${userId}: ${existingRecord?.name || normalizedMac}`);
                return sendSuccess(res, {
                    message: 'Device removed from favorites',
                    device: {
                        mac: normalizedMac,
                        isFavorite: false,
                        name: null
                    }
                });
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
            return sendError(res, 500, 'Failed to toggle favorite status', error.message);
        }
    }

    // POST /api/wol — Wake-on-LAN
    async sendWakeOnLan(req, res) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { device } = req.body;
            const userId = req.user.id;

            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(device.mac);
            } catch {
                normalizedMac = null;
            }

            // Look up in user's saved devices first, then fall back to scan cache
            let targetMac = normalizedMac;
            if (!targetMac && device.name) {
                const userDevices = this.deviceModel.getAllForUser(userId);
                const found = userDevices.find(d => d.name === device.name);
                if (found) targetMac = found.mac;
            }

            if (!targetMac) {
                return sendError(res, 404, `Device '${device.name || device.mac}' not found`);
            }

            const success = await this.wakeDeviceByMac(targetMac);
            if (success) {
                return sendSuccess(res, { message: `Wake-on-LAN packet sent to ${device.name || targetMac}` });
            } else {
                return sendError(res, 503, 'Failed to send Wake-on-LAN packet');
            }
        } catch (error) {
            console.error('WOL error:', error);
            return sendError(res, 500, 'Failed to send Wake-on-LAN packet', error.message);
        }
    }

    async wakeDeviceByMac(mac) {
        try {
            const normalizedMac = ValidationUtils.validateAndNormalizeMac(mac);
            const macForWol = normalizedMac.match(/.{2}/g).join(':');
            const result = await this.hostApi.sendWakeOnLan(macForWol);
            return result.success ?? false;
        } catch (error) {
            console.error('WOL error:', error);
            return false;
        }
    }

    // Used by the AI chat system prompt
    getDevicePromptInfo(userId) {
        const devices = userId
            ? this.deviceModel.getAllForUser(userId)
            : [];
        return JSON.stringify(
            devices.map(d => ({ name: d.name, mac: d.mac, ip: d.ip, status: d.status }))
        );
    }
}

module.exports = DeviceController;
