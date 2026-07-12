import { Request, Response } from 'express';
import Device from '../models/Device';
import Settings from '../models/Settings';
import ValidationUtils from '../utils/validation';
import HostApiService from '../services/hostApiService';
import { sendError, sendSuccess } from '../utils/response';

import { getErrorMessage } from '../utils/errors';

interface ScanEntry {
    mac: string;
    ip: string | null;
    status: string;
    lastSeen: string | null;
    scanMethod: string;
}

class DeviceController {
    private deviceModel: Device;
    private settingsModel: Settings;
    private hostApi: HostApiService;
    private scanCache: {
        byMac: Map<string, ScanEntry>;
        lastScan: number | null;
        scanInProgress: boolean;
    };

    constructor() {
        this.deviceModel = new Device();
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();

        this.scanCache = {
            byMac: new Map<string, ScanEntry>(),
            lastScan: null,
            scanInProgress: false
        };
    }

    getOnlineCount(): number {
        return this.scanCache.byMac.size;
    }

    async performNetworkScan(): Promise<ScanEntry[]> {
        try {
            const scanResult = await this.hostApi.scanNetwork(this.settingsModel.getScanTimeout());
            const data = scanResult.data as { devices?: Array<{ mac: string; ip: string }> } | undefined;
            if (!scanResult.success || !data?.devices) {
                console.error('Network scan failed from host API');
                return [];
            }

            const now = new Date().toISOString();
            return data.devices.map(device => ({
                mac: ValidationUtils.validateAndNormalizeMac(device.mac),
                ip: device.ip,
                status: 'online',
                lastSeen: now,
                scanMethod: 'network-scan'
            }));
        } catch (error: unknown) {
            console.error('Network scan error:', getErrorMessage(error));
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

            const scannedMacSet = new Set(scannedDevices.map(d => d.mac));

            this.scanCache.byMac = new Map(scannedDevices.map(d => [d.mac, d]));

            for (const d of scannedDevices) {
                this.deviceModel.updateScanDataForMac(d.mac, d.ip || '', 'online', now);
            }

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

    async ensureFreshScan() {
        const cacheExpired = !this.scanCache.lastScan ||
            (Date.now() - this.scanCache.lastScan) > this.settingsModel.getCacheTimeout();
        if (cacheExpired || this.scanCache.byMac.size === 0) {
            await this.runScan();
        }
    }

    buildDeviceListForUser(userId: number) {
        const userSaved = this.deviceModel.getAllForUser(userId);
        const userSavedMacs = new Set(userSaved.map(d => d.mac));

        const result = userSaved.map(d => ({ ...d }));

        for (const [mac, scanEntry] of this.scanCache.byMac) {
            if (!userSavedMacs.has(mac)) {
                result.push({
                    id: 0,
                    userId: userId,
                    mac,
                    ip: scanEntry.ip,
                    status: scanEntry.status,
                    lastSeen: scanEntry.lastSeen,
                    isFavorite: false,
                    name: null,
                    description: null,
                    rustdeskId: null,
                    createdAt: '',
                    updatedAt: ''
                });
            }
        }

        return result;
    }

    // GET /api/devices
    async getDevices(req: Request, res: Response) {
        try {
            await this.ensureFreshScan();
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }
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
        } catch (error: unknown) {
            console.error('Get devices error:', error);
            return sendError(res, 500, 'Failed to retrieve devices', getErrorMessage(error));
        }
    }

    // POST /api/devices/scan
    async scanDevices(req: Request, res: Response) {
        try {
            await this.runScan();
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }
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
        } catch (error: unknown) {
            console.error('Scan devices error:', error);
            return sendError(res, 500, 'Failed to scan network for devices', getErrorMessage(error));
        }
    }

    // POST /api/devices/clear-cache
    async clearDeviceCache(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }

            const deletedCount = this.deviceModel.clearNonFavoritesForUser(userId);

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
        } catch (error: unknown) {
            console.error('Clear cache error:', error);
            return sendError(res, 500, 'Failed to clear device cache', getErrorMessage(error));
        }
    }

    // POST /api/devices
    async createDevice(req: Request, res: Response) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { name, mac, description, rustdeskId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }

            let validatedName, validatedMac, validatedDescription;
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
            } catch (validationError: unknown) {
                return sendError(res, 400, getErrorMessage(validationError));
            }

            const existing = this.deviceModel.findByMacForUser(userId, validatedMac);
            if (existing) {
                return sendError(res, 409, `You already have a device with MAC address ${validatedMac}`);
            }

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
        } catch (error: unknown) {
            console.error('Add device error:', error);
            return sendError(res, 500, 'Failed to create device', getErrorMessage(error));
        }
    }

    // PUT /api/devices/:mac
    async updateDevice(req: Request, res: Response) {
        try {
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const paramMac = req.params.mac as string;
            const { name, mac, description, rustdeskId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }

            if (!paramMac?.trim()) {
                return sendError(res, 400, 'MAC address parameter is required');
            }

            let validatedName, validatedMac, validatedParamMac, validatedDescription;
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
                validatedParamMac = ValidationUtils.validateAndNormalizeMac(paramMac.trim());
            } catch (validationError: unknown) {
                return sendError(res, 400, getErrorMessage(validationError));
            }

            const existingDevice = this.deviceModel.findByMacForUser(userId, validatedParamMac);
            if (!existingDevice) {
                return sendError(res, 404, 'Device not found');
            }

            if (validatedParamMac !== validatedMac) {
                const conflict = this.deviceModel.findByMacForUser(userId, validatedMac);
                if (conflict) {
                    return sendError(res, 409, `You already have a device with MAC address ${validatedMac}`);
                }

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
        } catch (error: unknown) {
            console.error('Update device error:', error);
            return sendError(res, 500, 'Failed to update device', getErrorMessage(error));
        }
    }

    // POST /api/devices/:mac/favorite
    async toggleFavorite(req: Request, res: Response) {
        try {
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }

            const mac = req.params.mac as string;
            if (!mac?.trim()) {
                return sendError(res, 400, 'MAC address is required');
            }

            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(mac.trim());
            } catch (validationError: unknown) {
                return sendError(res, 400, getErrorMessage(validationError));
            }

            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }
            await this.ensureFreshScan();

            const existingRecord = this.deviceModel.findByMacForUser(userId, normalizedMac);
            const currentlyFavorite = existingRecord?.isFavorite ?? false;
            const nowFavorite = !currentlyFavorite;

            if (nowFavorite) {
                if (!existingRecord) {
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
        } catch (error: unknown) {
            console.error('Toggle favorite error:', error);
            return sendError(res, 500, 'Failed to toggle favorite status', getErrorMessage(error));
        }
    }

    // POST /api/wol
    async sendWakeOnLan(req: Request, res: Response) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { device } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return sendError(res, 401, 'Unauthorized');
            }

            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(device.mac);
            } catch {
                normalizedMac = null;
            }

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
        } catch (error: unknown) {
            console.error('WOL error:', error);
            return sendError(res, 500, 'Failed to send Wake-on-LAN packet', getErrorMessage(error));
        }
    }

    async wakeDeviceByMac(mac: string): Promise<boolean> {
        try {
            const normalizedMac = ValidationUtils.validateAndNormalizeMac(mac);
            const parts = normalizedMac.match(/.{2}/g);
            const macForWol = parts ? parts.join(':') : normalizedMac;
            const result = await this.hostApi.sendWakeOnLan(macForWol);
            return result.success ?? false;
        } catch (error) {
            console.error('WOL error:', error);
            return false;
        }
    }

    getDevicePromptInfo(userId: number): string {
        const devices = userId
            ? this.deviceModel.getAllForUser(userId)
            : [];
        return JSON.stringify(
            devices.map(d => ({ name: d.name, mac: d.mac, ip: d.ip, status: d.status }))
        );
    }
}

export default DeviceController;
