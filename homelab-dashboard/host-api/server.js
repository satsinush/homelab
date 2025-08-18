const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const wol = require('wake_on_lan');
const app = express();

// CORS configuration - allow requests from homelab-dashboard
app.use(cors({
    origin: ['http://homelab-dashboard:5000', 'http://localhost:5001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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
