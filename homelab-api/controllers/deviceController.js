const Device = require('../models/Device');
const Settings = require('../models/Settings');
const ValidationUtils = require('../utils/validation');
const { exec } = require('child_process');
const wol = require('wake_on_lan');

class DeviceController {
    constructor() {
        this.deviceModel = new Device();
        this.settingsModel = new Settings();
        this.deviceCache = {
            devices: [], // All devices from database and cache
            lastScan: null,
            scanInProgress: false
        };
        this.systemNetworkInterfaces = [];
    }



    // Initialize network interfaces
    async initializeNetworkInterfaces() {
        await this.discoverNetworkInterfaces();
    }

    // Discover network interfaces at startup
    async discoverNetworkInterfaces() {
        return new Promise((resolve) => {
            exec('ip a', (error, stdout) => {
                if (error) {
                    console.error('Failed to get network interfaces:', error.message);
                    this.systemNetworkInterfaces = [];
                    resolve(this.systemNetworkInterfaces);
                    return;
                }

                const interfaces = [];
                const lines = stdout.split('\n');
                
                for (const line of lines) {
                    // Match interface lines like "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>"
                    const match = line.match(/^\d+:\s+([^:@]+)[@:]?\s*<.*>/);
                    if (match) {
                        const interfaceName = match[1].trim();
                        // Filter out loopback and other virtual interfaces
                        if (!interfaceName.includes('lo') && 
                            !interfaceName.includes('docker') && 
                            !interfaceName.includes('br-') &&
                            !interfaceName.includes('veth') &&
                            !interfaceName.includes('virbr')) {
                            interfaces.push(interfaceName);
                        }
                    }
                }
                
                this.systemNetworkInterfaces = interfaces.length > 0 ? interfaces : ['eth0']; // Fallback to eth0 if none found
                
                console.log(`Discovered network interfaces: ${this.systemNetworkInterfaces.join(', ')}`);
                resolve(this.systemNetworkInterfaces);
            });
        });
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
            // Run arp-scan to discover devices
            const scannedDevices = await new Promise((resolve) => {
                const cmd = 'arp-scan -l';
                exec(cmd, { timeout: this.settingsModel.getScanTimeout() }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('ARP scan error:', error.message);
                        resolve([]);
                        return;
                    }

                    const discoveredDevices = [];
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.+)$/);
                        if (match) {
                            const [, ip, mac, vendor] = match;
                            // Normalize MAC address for storage (lowercase, no separators)
                            const normalizedMac = ValidationUtils.validateAndNormalizeMac(mac);
                            
                            discoveredDevices.push({
                                ip: ip,
                                mac: normalizedMac,
                                vendor: vendor.trim(),
                                status: 'online',
                                lastSeen: new Date().toISOString(),
                                scanMethod: 'arp-scan'
                            });
                        }
                    }
                    
                    resolve(discoveredDevices);
                });
            });

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
            
            res.json({
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
            res.status(500).json({ error: `Failed to get devices: ${error.message}` });
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
            
            res.json({
                message: 'Device scan completed',
                devices: devices,
                totalDevices: devices.length,
                favoriteDevicesCount: favoriteCount,
                discoveredDevicesCount: discoveredCount,
                onlineDevices: onlineCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Scan devices error:', error);
            res.status(500).json({ error: `Failed to scan network: ${error.message}` });
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
            
            res.json({
                message: `Cleared cache and completed fresh scan`,
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
            res.status(500).json({ error: `Failed to clear cache and scan: ${error.message}` });
        }
    }

    // Create new favorite device
    async createDevice(req, res) {
        try {
            const { name, mac, description } = req.body;
            
            // Validate input at controller level
            let validatedName, validatedMac, validatedDescription;
            
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }

            // Check if device with this MAC already exists
            const existingDevice = this.deviceModel.findByMac(validatedMac);
            if (existingDevice) {
                return res.status(409).json({ error: `Device with MAC address ${validatedMac} already exists` });
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
            
            res.status(201).json({ 
                message: 'Favorite device created successfully', 
                device: newDevice
            });
        } catch (error) {
            console.error('Add device error:', error);
            res.status(500).json({ error: `Failed to create device: ${error.message}` });
        }
    }

    // Update existing favorite device
    async updateDevice(req, res) {
        try {
            const { mac: paramMac } = req.params;
            const { name, mac, description } = req.body;
            
            // Validate input at controller level
            let validatedName, validatedMac, validatedParamMac, validatedDescription;
            
            try {
                validatedName = ValidationUtils.validateDeviceName(name);
                validatedMac = ValidationUtils.validateAndNormalizeMac(mac);
                validatedDescription = ValidationUtils.validateDeviceDescription(description);
                validatedParamMac = ValidationUtils.validateAndNormalizeMac(paramMac);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }

            // Get existing device by MAC from URL parameter
            const existingDevice = this.deviceModel.findByMac(validatedParamMac);
            
            if (!existingDevice) {
                return res.status(404).json({ error: 'Device not found' });
            }

            // Only allow editing favorite devices
            if (!existingDevice.isFavorite) {
                return res.status(403).json({ error: 'Only favorite devices can be edited' });
            }

            // Check if MAC address is being changed to one that already exists
            if (validatedParamMac !== validatedMac) {
                const deviceWithSameMac = this.deviceModel.findByMac(validatedMac);
                if (deviceWithSameMac) {
                    return res.status(409).json({ error: `Another device with MAC address ${validatedMac} already exists` });
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
            res.json({ 
                message: 'Device updated successfully', 
                device: updatedDevice
            });
        } catch (error) {
            console.error('Update device error:', error);
            res.status(500).json({ error: `Failed to update device: ${error.message}` });
        }
    }

    // Toggle favorite status
    async toggleFavorite(req, res) {
        try {
            const { mac } = req.params;
            
            // Validate MAC address at controller level
            let normalizedMac;
            try {
                normalizedMac = ValidationUtils.validateAndNormalizeMac(mac);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
            
            // Find device in cache (could be favorite or discovered)
            const deviceData = await this.getDevicesFromCache();
            const targetDevice = deviceData.devices.find(d => d.mac === normalizedMac);
            
            if (!targetDevice) {
                return res.status(404).json({ error: 'Device not found' });
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
                
                const message = 'Device marked as favorite';
                res.json({ message: message, device: favoriteDevice });
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
                
                const message = 'Device removed from favorites';
                res.json({ message: message, device: discoveredDevice });
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
            res.status(500).json({ error: `Failed to toggle favorite: ${error.message}` });
        }
    }

    // Send WOL packet
    async sendWakeOnLan(req, res) {
        try {
            const { device } = req.body;
            
            if (!device) {
                return res.status(400).json({ error: 'Device identifier is required' });
            }
            
            // Get all devices from database
            const allDevices = this.deviceModel.getAll();
            
            // Find device by friendly name OR mac address
            const targetDevice = allDevices.find(d => 
                (d.name === device) ||
                (d.mac === device) ||
                (ValidationUtils.validateAndNormalizeMac(device) === d.mac)
            );

            if (!targetDevice) {
                return res.status(404).json({ error: `Device '${device}' not found` });
            }

            if (!targetDevice.isFavorite) {
                return res.status(400).json({ error: `Device '${device}' must be marked as favorite before sending WOL packets` });
            }

            // Convert MAC format for WOL library (expects colon format)
            // targetDevice.mac is in normalized format (00d86178e934), convert to 00:d8:61:78:e9:34
            const macForWol = targetDevice.mac.match(/.{2}/g).join(':');

            const message = await new Promise((resolve, reject) => {
                wol.wake(macForWol, (error) => {
                    if (error) {
                        console.error(`WoL error for ${device}:`, error);
                        reject(new Error(`Failed to send WoL packet: ${error.message}`));
                    } else {
                        const message = `WoL packet sent to ${targetDevice.name || targetDevice.mac} (${targetDevice.mac})`;
                        console.log(message);
                        resolve(message);
                    }
                });
            });
            
            res.json({ message: message });
        } catch (error) {
            console.error('WOL error:', error);
            res.status(500).json({ error: error.message });
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
