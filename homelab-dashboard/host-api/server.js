const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const wol = require('wake_on_lan');
const app = express();

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Homelab Host API',
            version: '1.0.0',
            description: 'Privileged backend running on the host machine for monitoring, package updates, network scanning and Wake-on-LAN',
        },
        servers: [
            {
                url: '',
                description: 'Relative API Base URL'
            }
        ]
    },
    apis: [
        __filename
    ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// CORS configuration - allow requests from homelab-dashboard
app.use(cors({
    origin: ['http://homelab-dashboard:5000', 'http://localhost:5001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Swagger Documentation Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

/**
 * @openapi
 * /:
 *   get:
 *     summary: Welcome root endpoint
 *     responses:
 *       200:
 *         description: Welcome message
 */
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the Homelab Host API' });
});

// Helper function to get platform-specific command
function getPlatformCommand(operation) {
    const commands = {
        networkScan: `arp-scan --localnet --numeric`,
        installedPackages: `pacman -Q`,
        packageUpdates: `pacman -Qu`,
        packageSyncTime: `stat -c %Z /var/lib/pacman/sync/core.db`
    };

    return commands[operation] || null;
}

// Parse network scan results into structured data
function parseNetworkScanResults(stdout) {
    const lines = stdout.trim().split('\n');
    const devices = [];

    // Linux arp-scan format: "192.168.1.1\taa:bb:cc:dd:ee:ff\tVendor"
    for (const line of lines) {
        const match = line.match(/^([\d.]+)\s+([0-9a-fA-F:]{17})\s+(.+)$/);
        if (match) {
            devices.push({
                ip: match[1],
                mac: match[2],
                vendor: match[3].trim()
            });
        }
    }

    return devices;
}

// Parse package results into structured data
function parsePackageResults(stdout) {
    const packages = [];
    const lines = stdout.trim().split('\n');

    // Linux pacman format: "package-name version"
    for (const line of lines) {
        const match = line.match(/^(.+?)\s+(.+?)$/);
        if (match) {
            packages.push({
                name: match[1].trim(),
                version: match[2].trim()
            });
        }
    }

    return packages;
}

// Health check endpoint
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Verify host-api status and system platform details
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (req, res) => {
    console.log("Received health check request");
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        hostname: os.hostname(),
        services: ['network-scan', 'wake-on-lan', 'package-management']
    });
});

// Network scan endpoint
/**
 * @openapi
 * /network/scan:
 *   post:
 *     summary: Scan host local network for active IP/MAC devices
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeout:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Scan results list
 *       500:
 *         description: Internal scan utility error
 */
app.post('/network/scan', (req, res) => {
    console.log("Received network scan request");
    const { timeout = 30000 } = req.body;
    
    const cmd = getPlatformCommand('networkScan');
    
    exec(cmd, { timeout }, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing network scan:', error);
            return res.status(500).json({ 
                success: false,
                error: error.message, 
                stderr: stderr,
                code: error.code 
            });
        }
        
        // Parse the output into structured data
        console.log('Network scan output:', stdout);
        const devices = parseNetworkScanResults(stdout, os.platform());
        console.log('Parsed devices:', devices);

        res.json({ 
            success: true,
            data: {
                devices: devices,
                scanMethod: 'arp-scan',
                platform: os.platform()
            },
            timestamp: new Date().toISOString()
        });
    });
});

// Package management endpoints
/**
 * @openapi
 * /packages/installed:
 *   get:
 *     summary: Retrieve list of host pacman/apt installed packages
 *     responses:
 *       200:
 *         description: Packages list
 */
app.get('/packages/installed', (req, res) => {
    console.log("Received request for installed packages");
    const cmd = getPlatformCommand('installedPackages');
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ 
                success: false,
                error: error.message, 
                stderr: stderr,
                code: error.code 
            });
        }
        
        // Parse the output into structured data
        const packages = parsePackageResults(stdout, os.platform());
        
        res.json({ 
            success: true,
            data: {
                packages: packages,
                platform: os.platform()
            },
            timestamp: new Date().toISOString()
        });
    });
});

/**
 * @openapi
 * /packages/updates:
 *   get:
 *     summary: Retrieve pending OS updates list
 *     responses:
 *       200:
 *         description: Updates list
 */
app.get('/packages/updates', (req, res) => {
    console.log("Received request for package updates");
    const cmd = getPlatformCommand('packageUpdates');
    
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
        res.json({ 
            success: !error,
            data: {
                updates: stdout.trim() || 'No updates available',
                platform: os.platform()
            },
            stderr: stderr.trim(),
            timestamp: new Date().toISOString(),
            code: error ? error.code : 0
        });
    });
});

/**
 * @openapi
 * /packages/sync-time:
 *   get:
 *     summary: Get last package database sync timestamp
 *     responses:
 *       200:
 *         description: Sync time payload
 */
app.get('/packages/sync-time', (req, res) => {
    console.log("Received request for package sync time");
    const cmd = getPlatformCommand('packageSyncTime');
    
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
        res.json({ 
            success: !error,
            data: {
                syncTime: stdout.trim() || 'Unknown',
                platform: os.platform()
            },
            stderr: stderr.trim(),
            timestamp: new Date().toISOString(),
            code: error ? error.code : 0
        });
    });
});

// Wake on LAN endpoint
/**
 * @openapi
 * /network/wake-on-lan:
 *   post:
 *     summary: Send Wake-on-LAN magic packet to target MAC address
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
 *         description: Magic packet sent successfully
 *       400:
 *         description: Invalid MAC or missing parameter
 *       500:
 *         description: Failed to transmit WOL packet
 */
app.post('/network/wake-on-lan', (req, res) => {
    console.log("Received Wake-on-LAN request");
    const { mac } = req.body;
    
    if (!mac) {
        return res.status(400).json({
            success: false,
            error: 'MAC address is required'
        });
    }
    
    // Validate MAC address format using regex
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid MAC address format. Expected format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX'
        });
    }
    
    // Convert to colon-separated format for WOL
    const macForWol = mac.replace(/[-]/g, ':');
    
    // Use the wake_on_lan package to send the magic packet
    wol.wake(macForWol, (error) => {
        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send Wake-on-LAN packet',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            data: {
                message: `Wake-on-LAN packet sent to ${macForWol}`,
                mac: macForWol,
                platform: os.platform()
            },
            timestamp: new Date().toISOString()
        });
    });
});

// Helper functions for /system/metrics
function getCpuUsage() {
    return new Promise((resolve) => {
        const first = os.cpus();
        setTimeout(() => {
            const second = os.cpus();
            let totalDiff = 0;
            let idleDiff = 0;
            for (let i = 0; i < first.length; i++) {
                const t1 = first[i].times;
                const t2 = second[i].times;
                const total1 = t1.user + t1.nice + t1.sys + t1.idle + t1.irq;
                const total2 = t2.user + t2.nice + t2.sys + t2.idle + t2.irq;
                totalDiff += total2 - total1;
                idleDiff += t2.idle - t1.idle;
            }
            const percentage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
            resolve(Math.round(percentage));
        }, 500);
    });
}

function getMemoryMetrics() {
    try {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
        const parseMetric = (name) => {
            const match = meminfo.match(new RegExp(`${name}:\\s+(\\d+)\\s+kB`));
            return match ? parseInt(match[1]) * 1024 : 0;
        };
        const total = parseMetric('MemTotal');
        const free = parseMetric('MemFree');
        const buffers = parseMetric('Buffers');
        const cached = parseMetric('Cached');
        const reclaimable = parseMetric('SReclaimable');
        
        const available = free + buffers + cached + reclaimable;
        const used = total - available;
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        
        return {
            total,
            used,
            free: available,
            cached,
            buffers,
            percentage
        };
    } catch (err) {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        return {
            total,
            used,
            free,
            cached: 0,
            buffers: 0,
            percentage
        };
    }
}

function getDiskMetrics() {
    return new Promise((resolve) => {
        exec('df -B1 /', (error, stdout) => {
            if (error) {
                return resolve({ total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' });
            }
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) {
                return resolve({ total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' });
            }
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 6) {
                const total = parseInt(parts[1]);
                const used = parseInt(parts[2]);
                const available = parseInt(parts[3]);
                const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
                return resolve({
                    total,
                    used,
                    available,
                    percentage,
                    filesystem: parts[0],
                    mountPoint: parts[5]
                });
            }
            resolve({ total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' });
        });
    });
}

function getTemperatureMetrics() {
    try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
            const tempRaw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
            const tempC = parseFloat(tempRaw.trim()) / 1000;
            return { cpu: tempC };
        }
    } catch (err) {
        console.error('Error reading temperature:', err);
    }
    return { cpu: null };
}

function getNetworkStats() {
    const readNetDev = () => {
        const content = fs.readFileSync('/proc/net/dev', 'utf8');
        const lines = content.trim().split('\n');
        const stats = {};
        for (let i = 2; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 10) {
                const name = parts[0].replace(':', '');
                const rxBytes = parseInt(parts[1]);
                const txBytes = parseInt(parts[9]);
                stats[name] = { rxBytes, txBytes };
            }
        }
        return stats;
    };

    return new Promise((resolve) => {
        try {
            const t1 = readNetDev();
            setTimeout(() => {
                const t2 = readNetDev();
                const interfaces = [];
                for (const name in t2) {
                    if (t1[name]) {
                        const rxSpeed = t2[name].rxBytes - t1[name].rxBytes;
                        const txSpeed = t2[name].txBytes - t1[name].txBytes;
                        interfaces.push({
                            name,
                            downloadSpeed: rxSpeed * 2,
                            uploadSpeed: txSpeed * 2,
                            active: rxSpeed > 0 || txSpeed > 0
                        });
                    }
                }
                resolve({ interfaces });
            }, 500);
        } catch (err) {
            resolve({ interfaces: [] });
        }
    });
}

// System metrics endpoint (substitutes Netdata)
/**
 * @openapi
 * /system/metrics:
 *   get:
 *     summary: Retrieve real-time CPU, memory, disk, network, and temperature metrics of host OS
 *     responses:
 *       200:
 *         description: Real-time host metrics payload
 *       500:
 *         description: Internal metrics collection error
 */
app.get('/system/metrics', async (req, res) => {
    const startTime = Date.now();
    try {
        const [cpuUsage, memoryMetrics, diskMetrics, networkStats] = await Promise.all([
            getCpuUsage(),
            getMemoryMetrics(),
            getDiskMetrics(),
            getNetworkStats()
        ]);

        const temperature = getTemperatureMetrics();
        const cpus = os.cpus();
        
        res.json({
            success: true,
            data: {
                system: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    uptime: Math.floor(os.uptime()),
                    source: 'host-api'
                },
                resources: {
                    cpu: {
                        usage: cpuUsage,
                        cores: cpus.length,
                        model: cpus.length > 0 ? cpus[0].model : 'Unknown'
                    },
                    memory: memoryMetrics,
                    disk: diskMetrics
                },
                temperature,
                network: {
                    interfaces: networkStats.interfaces,
                    source: 'host-api',
                    timestamp: new Date().toISOString()
                },
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                dataSource: 'host-api'
            }
        });
    } catch (err) {
        console.error('Failed to collect system metrics:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system metrics',
            details: err.message
        });
    }
});

app.listen(5001, '0.0.0.0', () => {
    console.log(`Homelab Host API Server running on http://0.0.0.0:5001`);
    console.log(`Simplified host API - System monitoring, Network scanning, Wake-on-LAN, and Package management`);
    console.log(`Platform: ${os.platform()}`);
});
