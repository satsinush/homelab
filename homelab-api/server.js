// C:\dev\homelab-api-server\server.js
const express = require('express');
const wol = require('wake_on_lan');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const app = express();
const port = 5000;

app.use(cors({
    origin: [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:3000',  // React dev server (if used)
        'https://admin.rpi5-server.home.arpa',  // Production domain
        'http://admin.rpi5-server.home.arpa',   // HTTP version
        'http://10.10.10.10',    // Direct IP access
        'https://10.10.10.10'    // HTTPS IP access
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add a simple health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        hostname: os.hostname(),
        version: '1.0.0'
    });
});

// Define devices with MAC addresses for WOL functionality
const WOL_DEVICES = {
    "Andrew-Computer": {
        name: "Andrew-Computer",
        mac: "00-D8-61-78-E9-34", // <<< REPLACE WITH YOUR PC's MAC ADDRESS
        description: "Main Desktop Computer"
    }
    // Add more devices for WOL as needed:
    // "HomeServer": {
    //     name: "HomeServer", 
    //     mac: "AA:BB:CC:DD:EE:FF",
    //     description: "Home Server"
    // }
};

// Network scanning configuration
const SCAN_CONFIG = {
    timeout: 30000, // 30 seconds
    description: "ARP scan for configured WOL devices"
};

// Cache for discovered devices (to avoid scanning too frequently)
let deviceCache = {
    devices: [],
    lastScan: null,
    scanInProgress: false
};

// Cache timeout (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

// Function to perform arp-scan to find IP addresses for configured MAC addresses
const scanForWolDevices = () => {
    return new Promise((resolve) => {
        // Scan the local network to build ARP table
        const cmd = 'arp-scan 10.10.10.0/24';
        exec(cmd, { timeout: SCAN_CONFIG.timeout }, (error, stdout, stderr) => {
            if (error) {
                console.error(`arp-scan error:`, error.message);
                resolve([]);
                return;
            }

            const arpEntries = new Map(); // MAC -> IP mapping
            const lines = stdout.split('\n');
            
            // Parse arp-scan output to build MAC->IP mapping
            for (const line of lines) {
                const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.+)$/);
                if (match) {
                    const [, ip, mac, vendor] = match;
                    const normalizedMac = mac.toUpperCase().replace(/:/g, '-');
                    arpEntries.set(normalizedMac, { ip, vendor: vendor.trim() });
                }
            }
            
            // Create device objects for each WOL device
            const devices = Object.values(WOL_DEVICES).map(wolDevice => {
                const normalizedMac = wolDevice.mac.toUpperCase().replace(/:/g, '-');
                const arpEntry = arpEntries.get(normalizedMac);
                
                return {
                    mac: normalizedMac,
                    friendlyName: wolDevice.name,
                    description: wolDevice.description,
                    deviceKey: normalizedMac,
                    ip: arpEntry?.ip || null,
                    vendor: arpEntry?.vendor || 'Unknown',
                    networkName: "LAN",
                    networkDescription: "Local Area Network",
                    wolEnabled: true,
                    scanMethod: 'arp-scan',
                    lastSeen: arpEntry ? new Date().toISOString() : null
                };
            });
            
            resolve(devices);
        });
    });
};

// Function to scan for WOL devices
const scanNetworks = async () => {
    if (deviceCache.scanInProgress) {
        console.log('Scan already in progress, skipping...');
        return deviceCache.devices;
    }

    deviceCache.scanInProgress = true;
    console.log('Starting ARP scan for WOL devices...');
    
    try {
        // Scan for configured WOL devices
        const devices = await scanForWolDevices();
        
        // Update cache
        deviceCache.devices = devices;
        deviceCache.lastScan = Date.now();
        deviceCache.scanInProgress = false;
        
        console.log(`ARP scan completed. Found ${devices.length} WOL devices (${devices.filter(d => d.ip).length} online, ${devices.filter(d => !d.ip).length} offline).`);
        return devices;
        
    } catch (error) {
        console.error('Error during ARP scan:', error);
        deviceCache.scanInProgress = false;
        return deviceCache.devices; // Return cached devices on error
    }
};

// Function to get devices (with caching)
const getDevices = async (forceScan = false) => {
    const now = Date.now();
    const cacheExpired = !deviceCache.lastScan || (now - deviceCache.lastScan) > CACHE_TIMEOUT;
    
    if (forceScan || cacheExpired || deviceCache.devices.length === 0) {
        return await scanNetworks();
    }
    
    return deviceCache.devices;
};

app.post('/api/wol', (req, res) => {
    const deviceName = req.body.device;
    const device = WOL_DEVICES[deviceName];

    if (!device || !device.mac) {
        return res.status(400).json({ error: "Device not found or MAC address missing." });
    }

    wol.wake(device.mac, (error) => {
        if (error) {
            console.error(`Error sending WoL packet to ${deviceName}:`, error);
            return res.status(500).json({ error: `Failed to send WoL packet: ${error.message}` });
        }
        res.status(200).json({ message: `WoL packet sent to ${deviceName} (${device.mac}).` });
    });
});

app.get('/api/devices', async (req, res) => {
    try {
        const forceScan = req.query.scan === 'true';
        const devices = await getDevices(forceScan);
        
        res.status(200).json({
            devices: devices,
            totalCount: devices.length,
            wolDevicesCount: devices.length, // All devices are WOL devices
            onlineDevicesCount: devices.filter(d => d.ip).length,
            offlineDevicesCount: devices.filter(d => !d.ip).length,
            lastScan: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null,
            scanConfig: {
                method: 'arp-scan',
                description: SCAN_CONFIG.description
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get devices: ${error.message}` });
    }
});

// Get just device names (for backward compatibility with WOL)
app.get('/api/devices/names', (req, res) => {
    res.status(200).json(Object.keys(WOL_DEVICES));
});

// Get WOL-enabled devices only
app.get('/api/devices/wol', (req, res) => {
    const wolDeviceList = Object.keys(WOL_DEVICES).map(deviceName => ({
        name: WOL_DEVICES[deviceName].name,
        mac: WOL_DEVICES[deviceName].mac,
        description: WOL_DEVICES[deviceName].description
    }));
    res.status(200).json(wolDeviceList);
});

// Trigger a network scan manually
app.post('/api/devices/scan', async (req, res) => {
    try {
        const devices = await scanNetworks();
        res.status(200).json({
            message: 'Network scan completed',
            devicesFound: devices.length,
            devices: devices,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to scan network: ${error.message}` });
    }
});

// Utility function to ping a device and check if it's online
const pingDevice = (ip) => {
    return new Promise((resolve) => {
        // Use different ping commands based on OS
        const isWindows = os.platform() === 'win32';
        const pingCmd = isWindows 
            ? `ping -n 1 -w 1000 ${ip}`  // Windows: 1 ping, 1000ms timeout
            : `ping -c 1 -W 1 ${ip}`;    // Linux/Unix: 1 ping, 1s timeout
        
        exec(pingCmd, (error) => {
            resolve(!error); // true if ping successful, false if failed
        });
    });
};

// Get device status by IP address
app.get('/api/device-status/:deviceIp', async (req, res) => {
    const deviceIp = req.params.deviceIp;
    
    try {
        const isOnline = await pingDevice(deviceIp);
        const devices = await getDevices();
        const device = devices.find(d => d.ip === deviceIp);
        
        if (!device) {
            return res.status(404).json({ error: "Device not found in discovered devices." });
        }

        res.status(200).json({
            ip: deviceIp,
            mac: device.mac,
            vendor: device.vendor,
            friendlyName: device.friendlyName,
            deviceKey: device.deviceKey,
            networkName: device.networkName,
            wolEnabled: device.wolEnabled,
            status: isOnline ? 'online' : 'offline',
            lastSeen: device.lastSeen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to check device status: ${error.message}` });
    }
});

// Get status of all discovered devices
app.get('/api/devices/status', async (req, res) => {
    try {
        const devices = await getDevices();
        
        const deviceStatuses = await Promise.all(
            devices.map(async (device) => {
                // Only ping devices that have an IP address
                let isOnline = false;
                if (device.ip) {
                    isOnline = await pingDevice(device.ip);
                }
                // WOL-only devices (no IP) are considered offline
                
                return {
                    ip: device.ip,
                    mac: device.mac,
                    vendor: device.vendor,
                    friendlyName: device.friendlyName,
                    deviceKey: device.deviceKey,
                    networkName: device.networkName,
                    networkDescription: device.networkDescription,
                    wolEnabled: device.wolEnabled,
                    status: isOnline ? 'online' : 'offline',
                    lastSeen: device.lastSeen,
                    scanMethod: device.scanMethod
                };
            })
        );
        
        // Group by network for better organization
        const networkGroups = {};
        deviceStatuses.forEach(device => {
            if (!networkGroups[device.networkName]) {
                networkGroups[device.networkName] = [];
            }
            networkGroups[device.networkName].push(device);
        });
        
        res.status(200).json({
            devices: deviceStatuses,
            devicesByNetwork: networkGroups,
            totalDevices: deviceStatuses.length,
            onlineDevices: deviceStatuses.filter(d => d.status === 'online').length,
            wolEnabledDevices: deviceStatuses.filter(d => d.wolEnabled).length,
            lastScan: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to check devices status: ${error.message}` });
    }
});

// Get system information
app.get('/api/system-info', (req, res) => {
    try {
        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: Math.floor(os.uptime()),
            loadavg: os.loadavg(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            cpus: os.cpus(),
            timestamp: new Date().toISOString()
        };
        res.status(200).json(systemInfo);
    } catch (error) {
        res.status(500).json({ error: `Failed to get system info: ${error.message}` });
    }
});

// Get CPU temperature (Raspberry Pi specific)
app.get('/api/temperature', (req, res) => {
    exec('vcgencmd measure_temp', (error, stdout) => {
        if (error) {
            // Fallback for non-Raspberry Pi systems
            res.status(200).json({ 
                cpu: 'N/A',
                gpu: 'N/A',
                error: 'Temperature monitoring not available on this system'
            });
        } else {
            const temp = stdout.trim().replace('temp=', '').replace("'C", '');
            res.status(200).json({ 
                cpu: parseFloat(temp),
                gpu: parseFloat(temp), // On RPi, CPU and GPU temps are usually the same
                unit: 'Celsius',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Get system resources (CPU, Memory, Disk)
app.get('/api/resources', (req, res) => {
    try {
        // Memory info
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // CPU info
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        
        // Get disk usage (Linux/Unix systems) - raw values in KB
        exec('df /', (error, stdout) => {
            let diskInfo = { used: 0, total: 0, free: 0, percentage: 0 };
            
            if (!error) {
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                    const diskLine = lines[1].split(/\s+/);
                    const totalKB = parseInt(diskLine[1]); // Total in KB
                    const usedKB = parseInt(diskLine[2]);  // Used in KB
                    const availableKB = parseInt(diskLine[3]); // Available in KB
                    const percentage = parseInt(diskLine[4].replace('%', ''));
                    
                    diskInfo = {
                        total: totalKB * 1024,      // Convert KB to bytes
                        used: usedKB * 1024,        // Convert KB to bytes
                        free: availableKB * 1024,   // Convert KB to bytes
                        percentage: percentage,
                        filesystem: diskLine[0]
                    };
                }
            }

            res.status(200).json({
                cpu: {
                    cores: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    speed: cpus[0]?.speed || 0,
                    loadAverage: loadAvg,
                    usage: Math.round(loadAvg[0] * 100 / cpus.length) // Approximate CPU usage
                },
                memory: {
                    total: Math.round(totalMem), // MB
                    used: Math.round(usedMem), // MB
                    free: Math.round(freeMem), // MB
                    percentage: Math.round((usedMem / totalMem) * 100)
                },
                disk: diskInfo,
                uptime: os.uptime(),
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get system resources: ${error.message}` });
    }
});

// Get network interface information
app.get('/api/network', (req, res) => {
    try {
        const interfaces = os.networkInterfaces();
        const networkInfo = {};
        
        Object.keys(interfaces).forEach(iface => {
            interfaces[iface].forEach(details => {
                if (details.family === 'IPv4' && !details.internal) {
                    networkInfo[iface] = {
                        address: details.address,
                        netmask: details.netmask,
                        mac: details.mac
                    };
                }
            });
        });

        // Get network statistics (Linux specific)
        exec('cat /proc/net/dev', (error, stdout) => {
            let stats = {};
            if (!error) {
                const lines = stdout.trim().split('\n');
                for (let i = 2; i < lines.length; i++) {
                    const parts = lines[i].trim().split(/\s+/);
                    const iface = parts[0].replace(':', '');
                    if (networkInfo[iface]) {
                        stats[iface] = {
                            rx_bytes: parseInt(parts[1]),
                            tx_bytes: parseInt(parts[9])
                        };
                    }
                }
            }

            res.status(200).json({
                interfaces: networkInfo,
                statistics: stats,
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get network info: ${error.message}` });
    }
});

// Get service status with display names
app.get('/api/services', (req, res) => {
    // Map of service name to display name
    const services = [
        { name: 'nginx', displayName: 'NGINX Web Server' },
        { name: 'sshd', displayName: 'SSH Daemon' },
        { name: 'homelab-api', displayName: 'Homelab API' },
        { name: 'ddclient', displayName: 'DDClient Dynamic DNS' },
        { name: 'pihole-FTL', displayName: 'Pi-hole FTL' },
        { name: 'rustdesk-server-hbbr', displayName: 'RustDesk Relay (hbbr)' },
        { name: 'rustdesk-server-hbbs', displayName: 'RustDesk Rendezvous (hbbs)' },
        { name: 'ufw', displayName: 'Uncomplicated Firewall (UFW)' },
        { name: 'unbound', displayName: 'Unbound DNS Resolver' }
    ];

    Promise.all(services.map(service => {
        return new Promise((resolve) => {
            exec(`systemctl is-active ${service.name}`, (error, stdout) => {
                const status = stdout.trim();
                resolve({
                    name: service.name,
                    displayName: service.displayName,
                    status: status === 'active' ? 'running' : 'stopped',
                    active: status === 'active'
                });
            });
        });
    }))
    .then(serviceStatuses => {
        res.status(200).json({
            services: serviceStatuses,
            timestamp: new Date().toISOString()
        });
    })
    .catch(error => {
        res.status(500).json({ error: `Failed to check services: ${error.message}` });
    });
});

// Get network scanning information and statistics
app.get('/api/networks', async (req, res) => {
    try {
        const devices = await getDevices();
        
        // Calculate statistics for the main LAN network
        const lanDevices = devices.filter(d => d.networkName === "LAN");
        const networkStats = [{
            name: "LAN",
            subnet: "10.10.10.0/24",
            description: "Local Area Network",
            scanType: "arp-scan",
            totalDevices: lanDevices.length,
            devicesWithMac: lanDevices.length, // All devices have MAC since they're from WOL config
            wolEnabledDevices: lanDevices.length, // All devices are WOL enabled
            onlineDevices: lanDevices.filter(d => d.ip).length,
            offlineDevices: lanDevices.filter(d => !d.ip).length,
            lastScanned: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null
        }];
        
        res.status(200).json({
            networks: networkStats,
            scanStatus: {
                inProgress: deviceCache.scanInProgress,
                lastScan: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null,
                cacheTimeout: CACHE_TIMEOUT / 1000, // in seconds
                scanMethod: 'arp-scan'
            },
            wolDevices: Object.keys(WOL_DEVICES).map(key => ({
                name: WOL_DEVICES[key].name,
                mac: WOL_DEVICES[key].mac,
                description: WOL_DEVICES[key].description
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get network information: ${error.message}` });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Node.js API listening at http://0.0.0.0:${port}`);
    
    // Perform initial network scan on startup (non-blocking)
    setTimeout(async () => {
        console.log('Performing initial network scan...');
        try {
            const devices = await scanNetworks();
            console.log(`Initial scan completed. Found ${devices.length} devices.`);
        } catch (error) {
            console.error('Initial network scan failed:', error.message);
        }
    }, 5000); // Wait 5 seconds after server start
});