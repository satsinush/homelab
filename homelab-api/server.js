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

// Define devices with MAC addresses and multiple IP addresses
const DEVICES = {
    "Andrew-Computer": {
        name: "Andrew-Computer",
        mac: "00-D8-61-78-E9-34", // <<< REPLACE WITH YOUR PC's MAC ADDRESS
        ips: [
            {
                ip: "10.10.10.13", // <<< REPLACE WITH YOUR PC's LOCAL IP
                type: "local"
            },
            {
                ip: "10.10.20.13", // <<< REPLACE WITH YOUR PC's LOCAL IP
                type: "vpn"
            }
            // Add more IPs as needed, e.g.:
            // { ip: "192.168.1.100", type: "vpn" }
        ]
    }
    // Example of device with multiple IPs:
    // "HomeServer": {
    //     name: "HomeServer",
    //     mac: "AA:BB:CC:DD:EE:FF",
    //     ips: [
    //         { ip: "10.10.10.10", type: "local" },
    //         { ip: "192.168.1.10", type: "vpn" },
    //         { ip: "172.16.0.10", type: "docker" }
    //     ]
    // }
};

app.post('/api/wol', (req, res) => {
    const deviceName = req.body.device;
    const device = DEVICES[deviceName];

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

app.get('/api/devices', (req, res) => {
    const deviceList = Object.keys(DEVICES).map(deviceName => ({
        name: DEVICES[deviceName].name,
        mac: DEVICES[deviceName].mac,
        ips: DEVICES[deviceName].ips
    }));
    res.status(200).json(deviceList);
});

// Get just device names (for backward compatibility)
app.get('/api/devices/names', (req, res) => {
    res.status(200).json(Object.keys(DEVICES));
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

// Get device status (online/offline) - checks all IPs for the device
app.get('/api/device-status/:deviceName', async (req, res) => {
    const deviceName = req.params.deviceName;
    const device = DEVICES[deviceName];
    
    if (!device || !device.ips || device.ips.length === 0) {
        return res.status(400).json({ error: "Device not found or no IP addresses configured." });
    }

    try {
        // Check all IPs for the device
        const ipStatuses = await Promise.all(
            device.ips.map(async (ipObj) => {
                const isOnline = await pingDevice(ipObj.ip);
                return {
                    ip: ipObj.ip,
                    type: ipObj.type,
                    status: isOnline ? 'online' : 'offline'
                };
            })
        );

        // Device is considered online if any IP is reachable
        const isDeviceOnline = ipStatuses.some(ipStatus => ipStatus.status === 'online');

        res.status(200).json({
            device: deviceName,
            mac: device.mac,
            ips: ipStatuses,
            overallStatus: isDeviceOnline ? 'online' : 'offline',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to check device status: ${error.message}` });
    }
});

// Get status of all devices
app.get('/api/devices/status', async (req, res) => {
    try {
        const deviceStatuses = await Promise.all(
            Object.keys(DEVICES).map(async (deviceName) => {
                const device = DEVICES[deviceName];
                
                // Check all IPs for this device
                const ipStatuses = await Promise.all(
                    device.ips.map(async (ipObj) => {
                        const isOnline = await pingDevice(ipObj.ip);
                        return {
                            ip: ipObj.ip,
                            type: ipObj.type,
                            status: isOnline ? 'online' : 'offline'
                        };
                    })
                );

                // Device is considered online if any IP is reachable
                const isDeviceOnline = ipStatuses.some(ipStatus => ipStatus.status === 'online');

                return {
                    device: deviceName,
                    mac: device.mac,
                    ips: ipStatuses,
                    overallStatus: isDeviceOnline ? 'online' : 'offline'
                };
            })
        );
        
        res.status(200).json({
            devices: deviceStatuses,
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
            cpus: os.cpus().length,
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Node.js API listening at http://0.0.0.0:${port}`);
});