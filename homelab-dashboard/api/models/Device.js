const database = require('./Database');

class Device {
    constructor() {
        this.db = database.getDatabase();
    }

    // Find device by MAC address
    findByMac(mac) {
        try {
            const stmt = this.db.prepare('SELECT * FROM devices WHERE mac = ?');
            const row = stmt.get(mac);
            
            if (!row) {
                return null;
            }
            
            try {
                const deviceData = JSON.parse(row.data);
                return {
                    ...deviceData,
                    mac: row.mac, // Ensure MAC is always set from the key
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            } catch (parseError) {
                console.error('Invalid device data for MAC', mac, ':', parseError.message);
                // Delete invalid device
                this.deleteByMac(mac);
                console.log(`Deleted device with invalid data: MAC ${mac}`);
                return null;
            }
        } catch (error) {
            console.error('Error finding device by MAC:', error);
            return null;
        }
    }

    // Get all devices from database
    getAll() {
        try {
            const stmt = this.db.prepare('SELECT * FROM devices ORDER BY updated_at DESC');
            const devices = stmt.all();
            const parsedDevices = [];
            
            // Parse devices and handle any with invalid data
            for (const device of devices) {
                try {
                    const deviceData = JSON.parse(device.data);
                    parsedDevices.push({
                        ...deviceData,
                        mac: device.mac, // Ensure MAC is always set from the key
                        createdAt: device.created_at,
                        updatedAt: device.updated_at
                    });
                } catch (parseError) {
                    console.error('Invalid device data for MAC', device.mac, ':', parseError.message);
                    // Delete invalid devices
                    try {
                        this.deleteByMac(device.mac);
                        console.log(`Deleted device with invalid data: MAC ${device.mac}`);
                    } catch (deleteError) {
                        console.error('Error deleting invalid device:', deleteError);
                    }
                }
            }
            
            return parsedDevices;
        } catch (error) {
            console.error('Error getting devices:', error);
            return [];
        }
    }

    // Save or update device in database
    save(deviceData) {
        try {
            const now = new Date().toISOString();
            
            if (!deviceData.mac) {
                throw new Error('MAC address is required for saving device');
            }
            
            // Check if device exists
            const existingDevice = this.findByMac(deviceData.mac);
            
            // Prepare data without MAC (since it's the primary key)
            const dataToStore = { ...deviceData };
            delete dataToStore.mac;
            delete dataToStore.createdAt;
            delete dataToStore.updatedAt;
            
            if (existingDevice) {
                // Update existing device
                const stmt = this.db.prepare('UPDATE devices SET data = ?, updated_at = ? WHERE mac = ?');
                stmt.run(JSON.stringify(dataToStore), now, deviceData.mac);
            } else {
                // Insert new device
                const stmt = this.db.prepare('INSERT INTO devices (mac, data, created_at, updated_at) VALUES (?, ?, ?, ?)');
                stmt.run(deviceData.mac, JSON.stringify(dataToStore), now, now);
            }
            
            return deviceData.mac; // Return MAC instead of numeric ID
        } catch (error) {
            console.error('Error saving device:', error);
            throw error;
        }
    }

    // Delete device from database
    deleteByMac(mac) {
        try {
            const stmt = this.db.prepare('DELETE FROM devices WHERE mac = ?');
            const result = stmt.run(mac);
            console.log(`Deleted device with MAC ${mac} from database`);
            return result.changes;
        } catch (error) {
            console.error('Error deleting device:', error);
            throw error;
        }
    }

    // Delete all non-favorite devices from database
    clearNonFavorites() {
        try {
            // Get all devices and filter for non-favorite ones
            const allDevices = this.getAll();
            const nonFavoriteDevices = allDevices.filter(device => !device.isFavorite && device.isFavorite !== undefined);
            
            console.log(`Found ${nonFavoriteDevices.length} non-favorite devices to clear out of ${allDevices.length} total devices`);
            
            if (nonFavoriteDevices.length > 0) {
                const stmt = this.db.prepare('DELETE FROM devices WHERE mac = ?');
                nonFavoriteDevices.forEach(device => {
                    // Double check that device is actually not favorite before deleting
                    if (!device.isFavorite) {
                        console.log(`Deleting non-favorite device: ${device.name || 'Unknown'} (${device.mac})`);
                        stmt.run(device.mac);
                    } else {
                        console.warn(`WARNING: Skipped deleting favorite device: ${device.name} (${device.mac})`);
                    }
                });
                console.log(`Deleted ${nonFavoriteDevices.length} non-favorite devices from database`);
            }
            
            return nonFavoriteDevices.length;
        } catch (error) {
            console.error('Error clearing non-favorite devices:', error);
            throw error;
        }
    }
}

module.exports = Device;
