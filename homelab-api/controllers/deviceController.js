const Device = require('../models/Device');
const Settings = require('../models/Settings');
const ValidationUtils = require('../utils/validation');
const HostApiService = require('../services/hostApiService');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses
class DeviceController {
    constructor() {
        this.deviceModel = new Device();
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();
        this.deviceCache = {
            devices: [], // All devices from database and cache
            lastScan: null,
            scanInProgress: false
        };
        this.systemNetworkInterfaces = [];
    }

    // Scan and update devices
    async scanAndUpdateDevices() {
        if (this.deviceCache.scanInProgress) {
            console.log('Scan already in progress...');
            return this.deviceCache.devices;
        }

        this.deviceCache.scanInProgress = true;
        console.log('Starting device scan...');
        
        try {
            const scannedDevices = await this.performNetworkScan();

            // Get current favorite devices from database (only favorites are persisted)
            const favoriteDevices = this.deviceModel.getAll();
            
            // Get existing cached devices to preserve discovered device data
            const existingCachedDevices = this.deviceCache.devices || [];
            
            console.log(`Scanned: ${scannedDevices.length} devices, Favorites in DB: ${favoriteDevices.length} devices, Cached: ${existingCachedDevices.length} devices`);
            
            const now = new Date().toISOString();
            const allDevices = [];
            
            // Create maps for efficient lookups
            const favoritesByMac = new Map(favoriteDevices.map(d => [d.mac, d]));
            const scannedByMac = new Map(scannedDevices.map(d => [d.mac, d]));
            const cachedByMac = new Map(existingCachedDevices.map(d => [d.mac, d]));
            
            // Process all scanned devices
            for (const scannedDevice of scannedDevices) {
                const favoriteDevice = favoritesByMac.get(scannedDevice.mac);
                const cachedDevice = cachedByMac.get(scannedDevice.mac);
                
                if (favoriteDevice) {
                    // Update favorite device with current scan data
                    const updatedDevice = {
                        ...favoriteDevice,
                        ip: scannedDevice.ip,
                        vendor: scannedDevice.vendor || favoriteDevice.vendor,
                        status: 'online',
                        lastSeen: now,
                        lastScanned: now,
                        scanMethod: scannedDevice.scanMethod
                    };
                    
                    this.deviceModel.save(updatedDevice);
                    allDevices.push(updatedDevice);
                } else {
                    // Discovered device - merge with existing cached data if available
                    const discoveredDevice = {
                        // Use cached device data as base if it exists
                        ...(cachedDevice || {}),
                        // Override with fresh scan data
                        mac: scannedDevice.mac,
                        ip: scannedDevice.ip,
                        vendor: scannedDevice.vendor || cachedDevice?.vendor || 'Unknown',
                        status: 'online',
                        lastSeen: now,
                        lastScanned: now,
                        scanMethod: scannedDevice.scanMethod,
                        // Ensure these stay as discovered device defaults
                        isFavorite: false,
                        name: null, // Don't persist custom names for discovered devices
                        description: null
                    };
                    
                    // Don't save to DB, just add to cache
                    allDevices.push(discoveredDevice);
                }
            }
            
            // Mark favorite devices not found in scan as offline
            for (const favoriteDevice of favoriteDevices) {
                if (!scannedByMac.has(favoriteDevice.mac)) {
                    const offlineDevice = {
                        ...favoriteDevice,
                        status: 'offline',
                        lastScanned: now,
                        // Keep IP for favorite devices even when offline
                    };
                    
                    this.deviceModel.save(offlineDevice);
                    allDevices.push(offlineDevice);
                }
            }
            
            // Keep discovered devices that weren't found in current scan as offline (but don't save to DB)
            for (const cachedDevice of existingCachedDevices) {
                if (!cachedDevice.isFavorite && !scannedByMac.has(cachedDevice.mac)) {
                    // Check if we already added this device to allDevices
                    const alreadyAdded = allDevices.some(d => d.mac === cachedDevice.mac);
                    if (!alreadyAdded) {
                        const offlineDiscoveredDevice = {
                            ...cachedDevice,
                            status: 'offline',
                            lastScanned: now,
                            // Keep the IP they had before
                        };
                        
                        // Don't save to DB, just keep in cache
                        allDevices.push(offlineDiscoveredDevice);
                    }
                }
            }
            
            // Final deduplication step to ensure no duplicate MAC addresses
            const devicesByMac = new Map();
            for (const device of allDevices) {
                devicesByMac.set(device.mac, device);
            }
            const deduplicatedDevices = Array.from(devicesByMac.values());
            
            this.deviceCache.devices = deduplicatedDevices;
            this.deviceCache.lastScan = Date.now();
            this.deviceCache.scanInProgress = false;
            
            const onlineCount = deduplicatedDevices.filter(d => d.status === 'online').length;
            const favoriteCount = deduplicatedDevices.filter(d => d.isFavorite).length;
            
            console.log(`Scan completed: ${deduplicatedDevices.length} total devices (${onlineCount} online, ${favoriteCount} favorites)`);
            return deduplicatedDevices;
            
        } catch (error) {
            console.error('Scan error:', error);
            this.deviceCache.scanInProgress = false;
            return this.deviceCache.devices;
        }
    }

    // Perform network scan using host API
    async performNetworkScan() {
        try {
            // Scan network using host API (now returns structured JSON)
            const scanResult = await this.hostApi.scanNetwork(this.settingsModel.getScanTimeout());
            if (!scanResult.success || !scanResult.data || !scanResult.data.devices) {
                console.error('Network scan failed from host API');
                return [];
            }

            const discoveredDevices = [];
            const devices = scanResult.data.devices;
            
            for (const device of devices) {
                // Normalize MAC address for storage (lowercase, no separators)
                const normalizedMac = ValidationUtils.validateAndNormalizeMac(device.mac);
                
                discoveredDevices.push({
                    ip: device.ip,
                    mac: normalizedMac,
                    vendor: device.vendor || 'Unknown',
                    status: 'online',
                    lastSeen: new Date().toISOString(),
                    scanMethod: 'network-scan'
                });
            }
            
            return discoveredDevices;
        } catch (error) {
            console.error('Network scan error:', error.message);
            return [];
        }
    }

    // Get devices with caching
    async getDevicesFromCache(forceScan = false) {
        const now = Date.now();
        const cacheExpired = !this.deviceCache.lastScan || (now - this.deviceCache.lastScan) > this.settingsModel.getCacheTimeout();
        
        if (forceScan || cacheExpired || this.deviceCache.devices.length === 0) {
            // Perform scan and update cache
            this.deviceCache.devices = await this.scanAndUpdateDevices();
        } else {
            // Use cached data but refresh favorites from database 
            const favoriteDevices = this.deviceModel.getAll();
            const cachedDevices = this.deviceCache.devices;
            
            // Merge cached discovered devices with current favorites from DB
            const favoritesByMac = new Map(favoriteDevices.map(d => [d.mac, d]));
            const mergedDevices = [];
            
            // Add all cached devices, updating favorites with DB data
            for (const cachedDevice of cachedDevices) {
                const favoriteDevice = favoritesByMac.get(cachedDevice.mac);
                if (favoriteDevice) {
                    mergedDevices.push(favoriteDevice);
                    favoritesByMac.delete(cachedDevice.mac);
                } else if (!cachedDevice.isFavorite) {
                    // Keep non-favorite cached devices
                    mergedDevices.push(cachedDevice);
                }
            }
            
            // Add any new favorites from DB that weren't in cache
            for (const favoriteDevice of favoritesByMac.values()) {
                mergedDevices.push(favoriteDevice);
            }
            
            this.deviceCache.devices = mergedDevices;
        }
        
        return {
            devices: this.deviceCache.devices,
            lastScan: this.deviceCache.lastScan,
            scanInProgress: this.deviceCache.scanInProgress
        };
    }

    // Clear cache
    clearCache() {
        this.deviceCache.devices = [];
        this.deviceCache.lastScan = null;
    }

    // Clear non-favorite devices from database and cache
    async clearNonFavorites() {
        console.log('Clearing non-favorite devices from database and cache...');
        
        // Clear non-favorite devices from database (if any were accidentally saved)
        const deletedCount = this.deviceModel.clearNonFavorites();
        
        // Clear the device cache to force fresh scan
        this.clearCache();
        
        // Perform a fresh scan
        const devices = await this.scanAndUpdateDevices();
        
        console.log(`Cleared ${deletedCount} non-favorite devices and completed fresh scan: ${devices.length} total devices`);
        
        return { devices, deletedCount };
    }

    // HTTP Endpoints

    // Get all devices
    async getDevices(req, res) {
        try {
            const deviceData = await this.getDevicesFromCache();
            const devices = deviceData.devices;
            
            // Calculate stats for compatibility
            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const discoveredCount = devices.filter(d => !d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;
            
            return sendSuccess(res, {
                devices: devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: discoveredCount,
                onlineDevices: onlineCount,
                lastScan: deviceData.lastScan ? new Date(deviceData.lastScan).toISOString() : null,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Get devices error:', error);
            return sendError(res, 500, 'Failed to retrieve devices', error.message);
        }
    }

    // Scan for devices
    async scanDevices(req, res) {
        try {
            const devices = await this.scanAndUpdateDevices();
            
            // Calculate stats
            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const discoveredCount = devices.filter(d => !d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;
            
            return sendSuccess(res, {
                message: 'Network scan completed successfully',
                devices: devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: discoveredCount,
                onlineDevices: onlineCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Scan devices error:', error);
            
            return sendError(res, 500, 'Failed to scan network for devices', error.message);
        }
    }

    // Clear cache and perform fresh scan
    async clearDeviceCache(req, res) {
        try {
            const result = await this.clearNonFavorites();
            const devices = result.devices;
            const deletedCount = result.deletedCount;
            
            // Calculate stats
            const favoriteCount = devices.filter(d => d.isFavorite).length;
            const discoveredCount = devices.filter(d => !d.isFavorite).length;
            const onlineCount = devices.filter(d => d.status === 'online').length;
            
            console.log(`Cleared ${deletedCount} non-favorite devices and completed fresh scan: ${devices.length} total devices, ${discoveredCount} discovered`);
            
            return sendSuccess(res, {
                message: 'Device cache cleared and network rescanned successfully',
                devices: devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: discoveredCount,
                onlineDevices: onlineCount,
                deletedCount: deletedCount,
                timestamp: new Date().toISOString(),
                cacheCleared: true
            });
        } catch (error) {
            console.error('Clear cache error:', error);
            return sendError(res, 500, 'Failed to clear device cache', error.message);
        }
    }

    // Create new favorite device
    async createDevice(req, res) {
        try {
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { name, mac, description } = req.body;
            
            // Validate input at controller level
            let validatedName, validatedMac, validatedDescription;
            
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }

            // Check if device with this MAC already exists
            const existingDevice = this.deviceModel.findByMac(validatedMac);
            if (existingDevice) {
                return sendError(res, 409, `Device with MAC address already exists: ${validatedMac}`);
            }

            // Create new favorite device (only favorites are saved to DB)
            const newDevice = {
                name: validatedName,
                mac: validatedMac,
                description: validatedDescription,
                isFavorite: true,
                status: 'offline',
                ip: null,
                vendor: 'Unknown',
                lastSeen: null,
                lastScanned: null,
                scanMethod: 'manual'
            };
            
            this.deviceModel.save(newDevice);
            
            // Clear cache to force refresh
            this.clearCache();
            
            console.log(`New favorite device created: ${newDevice.name} (${newDevice.mac})`);
            
            return sendSuccess(res, {
                message: 'Device created successfully',
                device: newDevice
            }, 201);
        } catch (error) {
            console.error('Add device error:', error);
            return sendError(res, 500, 'Failed to create device', error.message);
        }
    }

    // Update existing favorite device
    async updateDevice(req, res) {
        try {
            // Basic request validation
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { mac: paramMac } = req.params;
            const { name, mac, description } = req.body;

            if (!paramMac || typeof paramMac !== 'string' || !paramMac.trim()) {
                return sendError(res, 400, 'MAC address parameter is required');
            }
            
            // Validate input at controller level
            let validatedName, validatedMac, validatedParamMac, validatedDescription;
            
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
                validatedParamMac = ValidationUtils.validateAndNormalizeMac(paramMac.trim());
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }

            // Get existing device by MAC from URL parameter
            const existingDevice = this.deviceModel.findByMac(validatedParamMac);
            
            if (!existingDevice) {
                return sendError(res, 404, 'Device not found');
            }

            // Only allow editing favorite devices
            if (!existingDevice.isFavorite) {
                return sendError(res, 403, 'Only favorite devices can be edited');
            }

            // Check if MAC address is being changed to one that already exists
            if (validatedParamMac !== validatedMac) {
                const deviceWithSameMac = this.deviceModel.findByMac(validatedMac);
                if (deviceWithSameMac) {
                    return sendError(res, 409, `Device with MAC address ${validatedMac} already exists`);
                }
                
                // If MAC is changing, we need to delete the old entry and create a new one
                this.deviceModel.deleteByMac(validatedParamMac);
            }

            // Update device (keep as favorite)
            const updatedDevice = {
                ...existingDevice,
                name: validatedName,
                mac: validatedMac,
                description: validatedDescription,
                isFavorite: true // Always keep as favorite
            };

            this.deviceModel.save(updatedDevice);
            
            // Clear cache to force refresh
            this.clearCache();
            
            console.log(`Device updated: ${updatedDevice.name} (${updatedDevice.mac})`);
            return sendSuccess(res, { 
                message: 'Device updated successfully', 
                device: updatedDevice
            });
        } catch (error) {
            console.error('Update device error:', error);
            return sendError(res, 500, 'Failed to update device', error.message);
        }
    }

    // Toggle favorite status
    async toggleFavorite(req, res) {
        try {
            // Basic request validation
            if (!req.params || typeof req.params !== 'object') {
                return sendError(res, 400, 'Invalid request parameters');
            }

            const { mac } = req.params;
            
            if (!mac || typeof mac !== 'string' || !mac.trim()) {
                return sendError(res, 400, 'MAC address is required');
            }

            // Validate MAC address at controller level
            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(mac.trim());
            } catch (validationError) {
                return sendError(res, 400, validationError.message);
            }
            
            // Find device in cache (could be favorite or discovered)
            const deviceData = await this.getDevicesFromCache();
            const targetDevice = deviceData.devices.find(d => d.mac === normalizedMac);
            
            if (!targetDevice) {
                return sendError(res, 404, 'Device not found');
            }
            
            // Toggle favorite status
            const isFavorite = !targetDevice.isFavorite;
            
            if (isFavorite) {
                // Making it a favorite - save to database
                const favoriteDevice = {
                    ...targetDevice,
                    isFavorite: true,
                    name: targetDevice.name || `Device ${targetDevice.vendor || 'Unknown'}`,
                    description: targetDevice.description || ''
                };
                
                this.deviceModel.save(favoriteDevice);
                console.log(`Device marked as favorite: ${favoriteDevice.name} (${favoriteDevice.mac})`);
                
                // Clear cache to force refresh
                this.clearCache();
                
                return sendSuccess(res, { 
                    message: 'Device marked as favorite',
                    device: favoriteDevice 
                });
            } else {
                // Removing from favorites - delete from database
                this.deviceModel.deleteByMac(normalizedMac);
                console.log(`Device removed from favorites: ${targetDevice.name} (${targetDevice.mac})`);
                
                // Keep in cache as discovered device
                const discoveredDevice = {
                    ...targetDevice,
                    isFavorite: false,
                    name: null // Clear custom name for discovered devices
                };
                
                // Clear cache to force refresh
                this.clearCache();
                
                return sendSuccess(res, { 
                    message: 'Device removed from favorites',
                    device: discoveredDevice 
                });
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
            return sendError(res, 500, 'Failed to toggle favorite status', error.message);
        }
    }

    // Send WOL packet
    async sendWakeOnLan(req, res) {
        try {
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { device, name, mac } = req.body;

            // Normalize device identifier if it's a MAC address
            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(mac);
            } catch {
                normalizedMac = null;
            }

            // Get all devices from database
            const allDevices = this.deviceModel.getAll();

            // Find device by friendly name OR normalized mac address
            const targetDevice = allDevices.find(d =>
                (d.name === name) ||
                (normalizedMac && d.mac === normalizedMac)
            );

            if (!targetDevice) {
                console.log(`Device '${name}' not found`);
                return sendError(res, 404, `Device '${name}' not found`);
            }

            if (!targetDevice.isFavorite) {
                return sendError(res, 400, `Device '${name}' must be marked as favorite before sending Wake-on-LAN packets`);
            }

            const message = `Sending Wake-on-LAN packet to ${targetDevice.name || targetDevice.mac} (${targetDevice.mac})`;

            // Use helper to send WOL packet
            const success = await this.wakeDeviceByMac(targetDevice.mac);
            
            if (success) {
                return sendSuccess(res, { message: `Wake-on-LAN packet sent to ${targetDevice.name || targetDevice.mac}` });
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
            const allDevices = this.deviceModel.getAll();
            // Find device by normalized mac address
            const targetDevice = allDevices.find(d =>
                d.mac === normalizedMac
            );

            if (!targetDevice) {
                console.error(`Device with MAC ${mac} not found`);
                targetDevice = {
                    name: null,
                    mac: normalizedMac
                }
            }

            // Convert MAC format for WOL (colon-separated)
            const macForWol = normalizedMac.match(/.{2}/g).join(':');

            // Send wake on lan via host API
            const result = await this.hostApi.sendWakeOnLan(macForWol);
            
            if (result.success) {
                const message = `WoL packet sent to ${targetDevice.name || targetDevice.mac} (${targetDevice.mac})`;
                console.log(message);
                return true;
            } else {
                console.error(`WoL error for ${mac}:`, result.error || 'Unknown error');
                return false;
            }
        } catch (error) {
            console.error('WOL error:', error);
            return false;
        }
    }

    // Simple function for device prompt info (for use in chat system prompt)
    getDevicePromptInfo() {
        const devices = this.deviceModel.getAll();
        const info = devices.map(device => ({
            name: device.name,
            mac: device.mac,
            ip: device.ip,
            vendor: device.vendor,
            status: device.status
        }));
        return JSON.stringify(info);
    }
}

module.exports = DeviceController;
