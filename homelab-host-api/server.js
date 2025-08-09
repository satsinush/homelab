const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const wol = require('wake_on_lan');
const app = express();

// Platform detection
const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isMacOS = os.platform() === 'darwin';

// CORS configuration - allow requests from homelab-api
app.use(cors({
    origin: ['http://homelab-api:5000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Parse network scan results into structured data
function parseNetworkScanResults(stdout, platform) {
    const lines = stdout.trim().split('\n');
    const devices = [];
    
    if (platform === 'linux') {
        // Linux arp-scan format: "192.168.1.1\taa:bb:cc:dd:ee:ff\tVendor"
        for (const line of lines) {
            const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.+)$/);
            if (match) {
                devices.push({
                    ip: match[1],
                    mac: match[2],
                    vendor: match[3].trim()
                });
            }
        }
    } else if (platform === 'win32') {
        // Windows arp -a format: "  192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic"
        for (const line of lines) {
            const match = line.match(/\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})\s+(dynamic)/i);
            if (match) {
            devices.push({
                ip: match[1],
                mac: match[2].replace(/-/g, ':'),
                vendor: 'Unknown'
            });
            }
        }
    } else if (platform === 'darwin') {
        // macOS arp -a format: "? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]"
        for (const line of lines) {
            const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-fA-F:]{17})/);
            if (match) {
                devices.push({
                    ip: match[1],
                    mac: match[2],
                    vendor: 'Unknown'
                });
            }
        }
    }
    
    return devices;
}

// Parse package results into structured data
function parsePackageResults(stdout, platform) {
    const packages = [];
    
    if (platform === 'linux') {
        // Linux pacman format: "package-name version"
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            const match = line.match(/^(.+?)\s+(.+?)$/);
            if (match) {
                packages.push({
                    name: match[1].trim(),
                    version: match[2].trim()
                });
            }
        }
    } else if (platform === 'win32') {
        // Windows wmic product output (columns are aligned, not space-separated)
        const lines = stdout.trim().split('\n');
        if (lines.length < 2) return packages;
        // Find the index where the "Version" column starts
        const header = lines[0];
        const versionIdx = header.indexOf('Version');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const name = line.slice(0, versionIdx).trim();
            const version = line.slice(versionIdx).trim();
            if (name && version) {
                packages.push({
                    name,
                    version
                });
            }
        }
    } else if (platform === 'darwin') {
        // macOS brew format: "package version"
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                packages.push({
                    name: parts[0],
                    version: parts[1]
                });
            }
        }
    }
    
    return packages;
}

// Helper function to get platform-specific command
function getPlatformCommand(operation) {
    const commands = {
        networkScan: {
            linux: `arp-scan --localnet --numeric`,
            windows: 'arp -a',
            darwin: 'arp -a',
            fallback: 'echo "Network scan not available on this platform"'
        },
        installedPackages: {
            linux: `pacman -Q`,
            windows: 'wmic product get name,version',
            darwin: 'brew list --versions',
            fallback: 'echo "mock-package 1.0.0\ntest-package 2.1.0"'
        },
        packageUpdates: {
            linux: `pacman -Qu`,
            windows: 'echo "No updates available"',
            darwin: 'brew outdated',
            fallback: 'echo "All packages up to date"'
        },
        packageSyncTime: {
            linux: `stat -c %Z /var/lib/pacman/sync/core.db`,
            windows: `echo ${Date.now() / 1000}`,
            darwin: `echo ${Date.now() / 1000}`,
            fallback: `echo ${Date.now() / 1000}`
        }
    };

    const platformCommands = commands[operation];
    if (!platformCommands) return null;

    if (isLinux) return platformCommands.linux;
    if (isWindows) return platformCommands.windows;
    if (isMacOS) return platformCommands.darwin;
    return platformCommands.fallback;
}

// Health check endpoint
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

app.listen(5001, '0.0.0.0', () => {
    console.log(`Homelab Host API Server running on http://0.0.0.0:5001`);
    console.log(`Simplified host API - Network scanning, Wake-on-LAN, and Package management only`);
    console.log(`System monitoring delegated to Netdata`);
    console.log(`Platform: ${os.platform()}`);
});
