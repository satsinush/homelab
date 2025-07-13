// Simplified Homelab API Server - WOL Dashboard with Authentication

// Load environment variables first
require('dotenv').config();

const express = require('express');
const wol = require('wake_on_lan');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 5000;

// =============================================================================
// CONFIGURATION & DATABASE
// =============================================================================

// Initialize SQLite database
const dbPath = path.join(__dirname, 'data');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

const db = new Database(path.join(dbPath, 'homelab.db'));

// Initialize database tables
db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
        mac TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        roles TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        expired INTEGER NOT NULL,
        sess TEXT NOT NULL
    );
`);

// Authentication constants
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Validate required environment variables
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is required!');
    console.error('Please set JWT_SECRET in your .env file or environment variables.');
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error('ERROR: SESSION_SECRET environment variable is required!');
    console.error('Please set SESSION_SECRET in your .env file or environment variables.');
    process.exit(1);
}

// Default server settings
const DEFAULT_SETTINGS = {
    scanTimeout: 30000,
    cacheTimeout: 300000, // 5 minutes
    services: [
        { name: 'nginx', displayName: 'NGINX Web Server' },
        { name: 'sshd', displayName: 'SSH Daemon' },
        { name: 'homelab-api', displayName: 'Homelab API' },
        { name: 'ddclient', displayName: 'DDClient Dynamic DNS' },
        { name: 'pihole-FTL', displayName: 'Pi-hole FTL' },
        { name: 'rustdesk-server-hbbr', displayName: 'RustDesk Relay' },
        { name: 'rustdesk-server-hbbs', displayName: 'RustDesk Rendezvous' },
        { name: 'ufw', displayName: 'UFW Firewall' },
        { name: 'unbound', displayName: 'Unbound DNS' }
    ]
};

// Initialize settings
let serverSettings = { ...DEFAULT_SETTINGS };

// Device cache - simplified to just hold the current state
let deviceCache = {
    devices: [], // All devices from database
    lastScan: null,
    scanInProgress: false
};

// Network interfaces discovered at startup
let systemNetworkInterfaces = [];

// =============================================================================
// AUTHENTICATION FUNCTIONS
// =============================================================================

// Create default admin user
const createDefaultUser = async () => {
    try {
        const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users');
        const result = checkStmt.get();
        
        if (result.count === 0) {
            const salt = uuidv4();
            const passwordHash = await argon2.hash('password', { salt: Buffer.from(salt) });
            
            const insertStmt = db.prepare(`
                INSERT INTO users (username, password_hash, salt, roles) 
                VALUES (?, ?, ?, ?)
            `);
            
            insertStmt.run('admin', passwordHash, salt, JSON.stringify(['admin']));
            console.log('Default admin user created (username: admin, password: password)');
        }
    } catch (error) {
        console.error('Error creating default user:', error);
    }
};

// Authenticate user
const authenticateUser = async (username, password) => {
    try {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username);
        
        if (!user) {
            return null;
        }
        
        const isValid = await argon2.verify(user.password_hash, password);
        
        if (!isValid) {
            return null;
        }
        
        // Update last login
        const updateStmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
        updateStmt.run(user.id);
        
        return {
            id: user.id,
            username: user.username,
            roles: JSON.parse(user.roles),
            lastLogin: user.last_login
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
};

// Create JWT token for user
const createToken = (userId) => {
    try {
        const token = jwt.sign(
            { 
                userId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
            },
            JWT_SECRET
        );
        
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
        
        return { token, expiresAt };
    } catch (error) {
        console.error('Token creation error:', error);
        return null;
    }
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user data
        const stmt = db.prepare(`
            SELECT u.id, u.username, u.roles 
            FROM users u 
            WHERE u.id = ?
        `);
        
        const user = stmt.get(decoded.userId);
        
        if (!user) {
            return null;
        }
        
        return {
            userId: user.id,
            username: user.username,
            roles: JSON.parse(user.roles)
        };
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};

// Authentication middleware
const requireAuth = (requiredRole = null) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const user = verifyToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Check role if specified
        if (requiredRole && !user.roles.includes(requiredRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.user = user;
        next();
    };
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Load settings from database
const loadSettings = () => {
    try {
        const settingsStmt = db.prepare('SELECT data FROM settings WHERE id = ?');
        const result = settingsStmt.get('server-config');
        
        if (result) {
            serverSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(result.data) };
            console.log('Server settings loaded from database');
        } else {
            // Insert default settings
            const insertStmt = db.prepare('INSERT INTO settings (id, data) VALUES (?, ?)');
            insertStmt.run('server-config', JSON.stringify(DEFAULT_SETTINGS));
            console.log('Default settings created');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
};

// Cache timeout from settings
const getCacheTimeout = () => serverSettings.cacheTimeout || 300000;

// Validate MAC address format and normalize it
const validateAndNormalizeMac = (mac) => {
    if (!mac) {
        throw new Error('MAC address is required');
    }
    
    const macClean = mac.replace(/[^a-fA-F0-9]/g, '');
    if (macClean.length !== 12) {
        throw new Error('Invalid MAC address format');
    }
    
    return macClean.toUpperCase().match(/.{2}/g).join('-');
};

// Check if device exists by MAC address (now simplified since MAC is the primary key)
const findDeviceByMac = (mac) => {
    try {
        const stmt = db.prepare('SELECT * FROM devices WHERE mac = ?');
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
            const deleteStmt = db.prepare('DELETE FROM devices WHERE mac = ?');
            deleteStmt.run(mac);
            console.log(`Deleted device with invalid data: MAC ${mac}`);
            return null;
        }
    } catch (error) {
        console.error('Error finding device by MAC:', error);
        return null;
    }
};

// Get all devices from database - simplified with MAC as primary key
const getAllDevices = () => {
    try {
        const stmt = db.prepare('SELECT * FROM devices ORDER BY updated_at DESC');
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
                    const deleteStmt = db.prepare('DELETE FROM devices WHERE mac = ?');
                    deleteStmt.run(device.mac);
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
};

// Save or update device in database using MAC as primary key
const saveDevice = (deviceData) => {
    try {
        const now = new Date().toISOString();
        
        if (!deviceData.mac) {
            throw new Error('MAC address is required for saving device');
        }
        
        // Check if device exists
        const existingDevice = findDeviceByMac(deviceData.mac);
        
        // Prepare data without MAC (since it's the primary key)
        const dataToStore = { ...deviceData };
        delete dataToStore.mac;
        delete dataToStore.createdAt;
        delete dataToStore.updatedAt;
        
        if (existingDevice) {
            // Update existing device
            const stmt = db.prepare('UPDATE devices SET data = ?, updated_at = ? WHERE mac = ?');
            stmt.run(JSON.stringify(dataToStore), now, deviceData.mac);
        } else {
            // Insert new device
            const stmt = db.prepare('INSERT INTO devices (mac, data, created_at, updated_at) VALUES (?, ?, ?, ?)');
            stmt.run(deviceData.mac, JSON.stringify(dataToStore), now, now);
        }
        
        return deviceData.mac; // Return MAC instead of numeric ID
    } catch (error) {
        console.error('Error saving device:', error);
        throw error;
    }
};

// Delete device from database using MAC as primary key
const deleteDevice = (mac) => {
    try {
        const stmt = db.prepare('DELETE FROM devices WHERE mac = ?');
        const result = stmt.run(mac);
        console.log(`Deleted device with MAC ${mac} from database`);
        return result.changes;
    } catch (error) {
        console.error('Error deleting device:', error);
        throw error;
    }
};

// Delete all non-favorite devices from database
const clearNonFavoriteDevices = () => {
    try {
        // Get all devices and filter for non-favorite ones
        const allDevices = getAllDevices();
        const nonFavoriteDevices = allDevices.filter(device => !device.isFavorite && device.isFavorite !== undefined);
        
        console.log(`Found ${nonFavoriteDevices.length} non-favorite devices to clear out of ${allDevices.length} total devices`);
        
        if (nonFavoriteDevices.length > 0) {
            const stmt = db.prepare('DELETE FROM devices WHERE mac = ?');
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
};

// Simplified network scanning - scan and update devices without complex deduplication
const scanAndUpdateDevices = async () => {
    if (deviceCache.scanInProgress) {
        console.log('Scan already in progress...');
        return deviceCache.devices;
    }

    deviceCache.scanInProgress = true;
    console.log('Starting device scan...');
    
    try {
        // Run arp-scan to discover devices
        const scannedDevices = await new Promise((resolve) => {
            const cmd = 'arp-scan -l';
            exec(cmd, { timeout: serverSettings.scanTimeout }, (error, stdout, stderr) => {
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
                        const normalizedMac = mac.toUpperCase().replace(/:/g, '-');
                        
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
        const favoriteDevices = getAllDevices();
        
        // Get existing cached devices to preserve discovered device data
        const existingCachedDevices = deviceCache.devices || [];
        
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
                
                saveDevice(updatedDevice);
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
                
                saveDevice(offlineDevice);
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
        
        deviceCache.devices = deduplicatedDevices;
        deviceCache.lastScan = Date.now();
        deviceCache.scanInProgress = false;
        
        const onlineCount = deduplicatedDevices.filter(d => d.status === 'online').length;
        const favoriteCount = deduplicatedDevices.filter(d => d.isFavorite).length;
        
        console.log(`Scan completed: ${deduplicatedDevices.length} total devices (${onlineCount} online, ${favoriteCount} favorites)`);
        return deduplicatedDevices;
        
    } catch (error) {
        console.error('Scan error:', error);
        deviceCache.scanInProgress = false;
        return deviceCache.devices;
    }
};

// Get devices with caching
const getDevices = async (forceScan = false) => {
    const now = Date.now();
    const cacheExpired = !deviceCache.lastScan || (now - deviceCache.lastScan) > getCacheTimeout();
    
    if (forceScan || cacheExpired || deviceCache.devices.length === 0) {
        // Perform scan and update cache
        deviceCache.devices = await scanAndUpdateDevices();
    } else {
        // Use cached data but refresh favorites from database 
        const favoriteDevices = getAllDevices();
        const cachedDevices = deviceCache.devices;
        
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
        
        deviceCache.devices = mergedDevices;
    }
    
    return {
        devices: deviceCache.devices,
        lastScan: deviceCache.lastScan,
        scanInProgress: deviceCache.scanInProgress
    };
};

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:3000',  // React dev server
        'https://admin.rpi5-server.home.arpa',  // Production domain
        'http://admin.rpi5-server.home.arpa',   // HTTP version
        'http://10.10.10.10',    // Direct IP access
        'https://10.10.10.10'    // HTTPS IP access
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 1000, // 1 second
    max: process.env.NODE_ENV === 'production' ? 1 : 1, // Stricter in production
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Session configuration with SQLite store
app.use(session({
    store: new SQLiteStore({
        db: 'homelab.db',
        dir: path.join(__dirname, 'data'),
        table: 'sessions',
        concurrentDB: true
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json());

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

// Login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = await authenticateUser(username, password);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const tokenData = createToken(user.id);
        
        if (!tokenData) {
            return res.status(500).json({ error: 'Failed to create token' });
        }
        
        // Store token in session
        req.session.token = tokenData.token;
        req.session.userId = user.id;
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                roles: user.roles
            },
            token: tokenData.token,
            expiresAt: tokenData.expiresAt
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            res.json({ message: 'Logout successful' });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user info
app.get('/api/auth/me', requireAuth(), (req, res) => {
    res.json({
        user: {
            id: req.user.userId,
            username: req.user.username,
            roles: req.user.roles
        }
    });
});

// Verify token endpoint
app.post('/api/auth/verify', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const user = verifyToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        res.json({
            valid: true,
            user: {
                id: user.userId,
                username: user.username,
                roles: user.roles
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
app.put('/api/auth/profile', requireAuth(), async (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body;
        const userId = req.user.userId;
        
        // Validate input
        if (!username || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }
        
        if (newPassword && newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        
        // Get current user data
        const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const user = userStmt.get(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // If changing password, verify current password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required to change password' });
            }
            
            const isCurrentPasswordValid = await argon2.verify(user.password_hash, currentPassword);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }
        
        // Check if username is already taken (by another user)
        const existingUserStmt = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?');
        const existingUser = existingUserStmt.get(username, userId);
        
        if (existingUser) {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        
        // Update user data
        if (newPassword) {
            const hashedPassword = await argon2.hash(newPassword);
            const updateStmt = db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?');
            updateStmt.run(username, hashedPassword, userId);
        } else {
            const updateStmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');
            updateStmt.run(username, userId);
        }
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: userId,
                username: username,
                roles: JSON.parse(user.roles)
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check (no auth required)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        hostname: os.hostname(),
        version: '1.0.0'
    });
});

// =============================================================================
// SIMPLIFIED DEVICE ENDPOINTS
// =============================================================================

// GET /devices - Get all devices from cache and database
app.get('/api/devices', requireAuth('admin'), async (req, res) => {
    try {
        const deviceData = await getDevices();
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
            lastScan: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: `Failed to get devices: ${error.message}` });
    }
});

// POST /devices/scan - Scan for devices and update database
app.post('/api/devices/scan', requireAuth('admin'), async (req, res) => {
    try {
        const devices = await scanAndUpdateDevices();
        
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
});

// POST /devices/clear-cache - Clear non-saved devices and perform fresh scan
app.post('/api/devices/clear-cache', requireAuth('admin'), async (req, res) => {
    try {
        console.log('Clearing non-favorite devices from database and cache...');
        
        // Clear non-favorite devices from database (if any were accidentally saved)
        const deletedCount = clearNonFavoriteDevices();
        
        // Clear the device cache to force fresh scan
        deviceCache.devices = [];
        deviceCache.lastScan = null;
        
        // Perform a fresh scan
        const devices = await scanAndUpdateDevices();
        
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
});

// POST /devices - Add new favorite device with proper validation
app.post('/api/devices', requireAuth('admin'), async (req, res) => {
    try {
        const { name, mac, description } = req.body;
        
        if (!name || !mac) {
            return res.status(400).json({ error: 'Name and MAC address are required' });
        }

        // Validate and normalize MAC address
        let macFormatted;
        try {
            macFormatted = validateAndNormalizeMac(mac);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        // Check if device with this MAC already exists
        const existingDevice = findDeviceByMac(macFormatted);
        if (existingDevice) {
            return res.status(409).json({ 
                error: `Device with MAC address ${macFormatted} already exists`,
                existingDevice: {
                    mac: existingDevice.mac,
                    name: existingDevice.name
                }
            });
        }

        // Create new favorite device (only favorites are saved to DB)
        const newDevice = {
            name: name.trim(),
            mac: macFormatted,
            description: description?.trim() || '',
            isFavorite: true,
            status: 'offline',
            ip: null,
            vendor: 'Unknown',
            lastSeen: null,
            lastScanned: null,
            scanMethod: 'manual'
        };
        
        saveDevice(newDevice);
        
        // Clear cache to force refresh
        deviceCache.devices = [];
        deviceCache.lastScan = null;
        
        console.log(`New favorite device created: ${newDevice.name} (${newDevice.mac})`);
        res.status(201).json({ 
            message: 'Favorite device created successfully', 
            device: newDevice 
        });
    } catch (error) {
        console.error('Add device error:', error);
        res.status(500).json({ error: `Failed to create device: ${error.message}` });
    }
});

// PUT /devices/:mac - Update existing favorite device with proper validation
app.put('/api/devices/:mac', requireAuth('admin'), async (req, res) => {
    try {
        const { mac: paramMac } = req.params;
        const { name, mac, description } = req.body;
        
        if (!name || !mac) {
            return res.status(400).json({ error: 'Name and MAC address are required' });
        }

        // Validate and normalize MAC addresses
        let paramMacFormatted, bodyMacFormatted;
        try {
            paramMacFormatted = validateAndNormalizeMac(paramMac);
            bodyMacFormatted = validateAndNormalizeMac(mac);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        // Get existing device by MAC from URL parameter
        const existingDevice = findDeviceByMac(paramMacFormatted);
        
        if (!existingDevice) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Only allow editing favorite devices
        if (!existingDevice.isFavorite) {
            return res.status(403).json({ error: 'Only favorite devices can be edited' });
        }

        // Check if MAC address is being changed to one that already exists
        if (paramMacFormatted !== bodyMacFormatted) {
            const deviceWithSameMac = findDeviceByMac(bodyMacFormatted);
            if (deviceWithSameMac) {
                return res.status(409).json({ 
                    error: `Another device with MAC address ${bodyMacFormatted} already exists`,
                    conflictingDevice: {
                        mac: deviceWithSameMac.mac,
                        name: deviceWithSameMac.name
                    }
                });
            }
            
            // If MAC is changing, we need to delete the old entry and create a new one
            deleteDevice(paramMacFormatted);
        }

        // Update device (keep as favorite)
        const updatedDevice = {
            ...existingDevice,
            name: name.trim(),
            mac: bodyMacFormatted,
            description: description?.trim() || '',
            isFavorite: true // Always keep as favorite
        };

        saveDevice(updatedDevice);
        
        // Clear cache to force refresh
        deviceCache.devices = [];
        deviceCache.lastScan = null;
        
        console.log(`Device updated: ${updatedDevice.name} (${updatedDevice.mac})`);
        res.json({ 
            message: 'Device updated successfully', 
            device: updatedDevice 
        });
    } catch (error) {
        console.error('Update device error:', error);
        res.status(500).json({ error: `Failed to update device: ${error.message}` });
    }
});

// POST /devices/:mac/favorite - Toggle favorite status
app.post('/api/devices/:mac/favorite', requireAuth('admin'), async (req, res) => {
    try {
        const { mac } = req.params;
        
        // Validate and normalize MAC address
        let macFormatted;
        try {
            macFormatted = validateAndNormalizeMac(mac);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        
        // Find device in cache (could be favorite or discovered)
        const deviceData = await getDevices();
        const targetDevice = deviceData.devices.find(d => d.mac === macFormatted);
        
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
            
            saveDevice(favoriteDevice);
            console.log(`Device marked as favorite: ${favoriteDevice.name} (${favoriteDevice.mac})`);
            
            res.json({ 
                message: 'Device marked as favorite', 
                device: favoriteDevice 
            });
        } else {
            // Removing from favorites - delete from database
            deleteDevice(macFormatted);
            console.log(`Device removed from favorites: ${targetDevice.name} (${targetDevice.mac})`);
            
            // Keep in cache as discovered device
            const discoveredDevice = {
                ...targetDevice,
                isFavorite: false,
                name: null // Clear custom name for discovered devices
            };
            
            res.json({ 
                message: 'Device removed from favorites', 
                device: discoveredDevice 
            });
        }
        
        // Clear cache to force refresh
        deviceCache.devices = [];
        deviceCache.lastScan = null;
        
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ error: `Failed to toggle favorite: ${error.message}` });
    }
});

// POST /wol - Send WOL packet
app.post('/api/wol', requireAuth('admin'), async (req, res) => {
    try {
        const { device } = req.body;
        
        if (!device) {
            return res.status(400).json({ error: 'Device identifier is required' });
        }
        
        // Get all devices from database
        const allDevices = getAllDevices();
        
        // Find device by friendly name OR mac address OR device key
        const targetDevice = allDevices.find(d => 
            (d.name === device) ||
            (d.mac === device) ||
            (d.mac.replace(/-/g, ':') === device) ||
            (d.mac.replace(/-/g, ':').toUpperCase() === device.toUpperCase())
        );

        if (!targetDevice) {
            return res.status(404).json({ error: `Device '${device}' not found.` });
        }

        if (!targetDevice.isFavorite) {
            return res.status(400).json({ error: `Device '${device}' must be marked as favorite before sending WOL packets.` });
        }

        // Convert MAC format for WOL library (expects colon format)
        const macForWol = targetDevice.mac.replace(/-/g, ':');

        wol.wake(macForWol, (error) => {
            if (error) {
                console.error(`WoL error for ${device}:`, error);
                return res.status(500).json({ error: `Failed to send WoL packet: ${error.message}` });
            }
            res.json({ 
                message: `WoL packet sent to ${targetDevice.name || targetDevice.mac} (${targetDevice.mac})` 
            });
        });
    } catch (error) {
        console.error('WOL error:', error);
        res.status(500).json({ error: `Failed to send WOL packet: ${error.message}` });
    }
});

// Get server settings
app.get('/api/settings', requireAuth('admin'), (req, res) => {
    res.json({ settings: serverSettings });
});

// Update server settings
app.put('/api/settings', requireAuth('admin'), (req, res) => {
    try {
        const newSettings = { ...serverSettings, ...req.body };
        
        const stmt = db.prepare('UPDATE settings SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const result = stmt.run(JSON.stringify(newSettings), 'server-config');
        
        if (result.changes === 0) {
            // Insert if doesn't exist
            const insertStmt = db.prepare('INSERT INTO settings (id, data) VALUES (?, ?)');
            insertStmt.run('server-config', JSON.stringify(newSettings));
        }
        
        serverSettings = newSettings;
        res.json({ message: 'Settings updated successfully', settings: serverSettings });
    } catch (error) {
        res.status(500).json({ error: `Failed to update settings: ${error.message}` });
    }
});

// Get all packages with update information
app.get('/api/packages', requireAuth('admin'), async (req, res) => {
    try {
        // Get all explicitly installed packages and available updates in parallel
        const getInstalledPackages = () => {
            return new Promise((resolve, reject) => {
                exec('pacman -Qe', { timeout: 30000 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Package list error:', error.message);
                        reject(error);
                        return;
                    }

                    const packages = new Map();
                    const lines = stdout.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        // pacman -Qe output format: "package-name version"
                        const match = line.match(/^(.+?)\s+(.+?)$/);
                        if (match) {
                            const [, name, version] = match;
                            packages.set(name.trim(), {
                                name: name.trim(),
                                currentVersion: version.trim(),
                                newVersion: null,
                                hasUpdate: false,
                                status: 'installed'
                            });
                        }
                    }
                    
                    resolve(packages);
                });
            });
        };

        const getPackageSyncTime = () => {
            return new Promise((resolve) => {
                exec('stat -c %Y /var/lib/pacman/sync/core.db', { timeout: 10000 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Package sync time error:', error.message);
                        resolve(null);
                        return;
                    }
                    
                    const timestamp = parseInt(stdout.trim());
                    if (!isNaN(timestamp)) {
                        resolve(new Date(timestamp * 1000));
                    } else {
                        resolve(null);
                    }
                });
            });
        };

        const getAvailableUpdates = () => {
            return new Promise((resolve) => {
                exec('pacman -Qu', { timeout: 30000 }, (error, stdout, stderr) => {
                    if (error) {
                        // If error is just "no upgrades", that's okay
                        if (error.code === 1 && !stdout.trim()) {
                            resolve(new Map());
                            return;
                        }
                        console.error('Package update check error:', error.message);
                        resolve(new Map());
                        return;
                    }

                    const updates = new Map();
                    const lines = stdout.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        // pacman -Qu output format: "package-name old-version -> new-version"
                        const match = line.match(/^(.+?)\s+(.+?)\s+->\s+(.+?)$/);
                        if (match) {
                            const [, name, currentVersion, newVersion] = match;
                            updates.set(name.trim(), {
                                currentVersion: currentVersion.trim(),
                                newVersion: newVersion.trim()
                            });
                        }
                    }
                    
                    resolve(updates);
                });
            });
        };

        // Execute all commands in parallel
        const [installedPackages, availableUpdates, syncTime] = await Promise.all([
            getInstalledPackages(),
            getAvailableUpdates(),
            getPackageSyncTime()
        ]);

        // Merge the data
        const packages = [];
        for (const [packageName, packageData] of installedPackages) {
            const updateInfo = availableUpdates.get(packageName);
            
            if (updateInfo) {
                // Package has an update available
                packages.push({
                    name: packageName,
                    currentVersion: updateInfo.currentVersion,
                    newVersion: updateInfo.newVersion,
                    hasUpdate: true,
                    status: 'upgradeable'
                });
            } else {
                // Package is up to date
                packages.push({
                    name: packageName,
                    currentVersion: packageData.currentVersion,
                    newVersion: null,
                    hasUpdate: false,
                    status: 'installed'
                });
            }
        }

        // Sort packages by name
        packages.sort((a, b) => a.name.localeCompare(b.name));

        const updatesAvailable = packages.filter(pkg => pkg.hasUpdate).length;
        
        res.json({
            packages: packages,
            totalPackages: packages.length,
            updatesAvailable: updatesAvailable,
            lastChecked: new Date().toISOString(),
            lastSynced: syncTime ? syncTime.toISOString() : null,
            packageManager: 'pacman',
            note: updatesAvailable > 0 
                ? `${updatesAvailable} updates available out of ${packages.length} packages`
                : `All ${packages.length} packages are up to date`
        });

    } catch (error) {
        console.error('Package fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch package information',
            details: error.message 
        });
    }
});



// Combined system information endpoint
app.get('/api/system', requireAuth('admin'), async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Gather all system data in parallel for better performance
        const [systemInfoResult, resourcesResult, temperatureResult, servicesResult, networkResult] = await Promise.allSettled([
            // System info
            new Promise((resolve) => {
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
                        memory: {
                            total: os.totalmem(),
                            used: os.totalmem() - os.freemem(),
                            free: os.freemem()
                        }
                    };
                    resolve(systemInfo);
                } catch (error) {
                    resolve(null);
                }
            }),
            
            // Resources
            new Promise((resolve) => {
                try {
                    const totalMem = os.totalmem();
                    const freeMem = os.freemem();
                    const usedMem = totalMem - freeMem;
                    const cpus = os.cpus();
                    const loadAvg = os.loadavg();
                    
                    // Get disk usage
                    exec('df /', (error, stdout) => {
                        let diskInfo = { total: 0, used: 0, free: 0, percentage: 0 };
                        
                        if (!error && stdout) {
                            const lines = stdout.trim().split('\n');
                            if (lines.length > 1) {
                                const diskLine = lines[1].split(/\s+/);
                                if (diskLine.length >= 4) {
                                    const total = parseInt(diskLine[1]) * 1024; // Convert from KB
                                    const used = parseInt(diskLine[2]) * 1024;
                                    const free = parseInt(diskLine[3]) * 1024;
                                    const percentage = Math.round((used / total) * 100);
                                    diskInfo = { total, used, free, percentage };
                                }
                            }
                        }
                        
                        const resources = {
                            cpu: {
                                usage: Math.round(loadAvg[0] * 100 / cpus.length),
                                cores: cpus.length,
                                loadAvg: loadAvg
                            },
                            memory: {
                                total: totalMem,
                                used: usedMem,
                                free: freeMem,
                                percentage: Math.round((usedMem / totalMem) * 100)
                            },
                            disk: diskInfo
                        };
                        
                        resolve(resources);
                    });
                } catch (error) {
                    resolve(null);
                }
            }),
            
            // Temperature
            new Promise((resolve) => {
                exec('vcgencmd measure_temp', (error, stdout) => {
                    if (error) {
                        resolve({ cpu: 'N/A', gpu: 'N/A' });
                    } else {
                        const temp = stdout.match(/temp=([0-9.]+)/);
                        resolve({
                            cpu: temp ? parseFloat(temp[1]) : 'N/A',
                            gpu: 'N/A'
                        });
                    }
                });
            }),
            
            // Services
            new Promise((resolve) => {
                const services = serverSettings.services || [];
                
                Promise.all(services.map(service => {
                    return new Promise((serviceResolve) => {
                        exec(`systemctl is-active ${service.name}`, (error, stdout) => {
                            const status = stdout.trim();
                            const active = status === 'active';
                            serviceResolve({
                                name: service.name,
                                displayName: service.displayName || service.name,
                                status: status,
                                active: active
                            });
                        });
                    });
                }))
                .then(serviceStatuses => resolve({ services: serviceStatuses }))
                .catch(() => resolve({ services: [] }));
            }),
            
            // Network data from Netdata
            new Promise(async (resolve) => {
                try {
                    const [networkStats, networkInterfaces] = await Promise.all([
                        getNetworkStats(),
                        getNetworkInterfaces()
                    ]);
                    
                    resolve({
                        ...networkStats,
                        interfaces: networkInterfaces,
                        detailedInterfaces: networkInterfaces
                    });
                } catch (error) {
                    console.error('Network data fetch error:', error);
                    resolve(null);
                }
            })
        ]);
        
        // Extract results from Promise.allSettled
        const systemInfo = systemInfoResult.status === 'fulfilled' ? systemInfoResult.value : null;
        const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
        const temperature = temperatureResult.status === 'fulfilled' ? temperatureResult.value : { cpu: 'N/A', gpu: 'N/A' };
        const services = servicesResult.status === 'fulfilled' ? servicesResult.value : { services: [] };
        const network = networkResult.status === 'fulfilled' ? networkResult.value : null;
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Return combined response
        res.json({
            system: systemInfo,
            resources: {
                ...resources,
                network: network
            },
            temperature: temperature,
            services: services,
            network: network,
            metadata: {
                timestamp: new Date().toISOString(),
                responseTime: `${responseTime}ms`,
                endpoint: 'combined'
            }
        });
        
    } catch (error) {
        console.error('Combined system endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to get system information',
            details: error.message 
        });
    }
});

// =============================================================================
// NETDATA INTEGRATION
// =============================================================================

// Netdata API helper function
const fetchNetdataData = async (endpoint, chart, dimension = null) => {
    try {
        const netdataUrl = process.env.NETDATA_URL || 'http://localhost:19999';
        let url = `${netdataUrl}/api/v1/data?chart=${chart}&format=json&points=3&after=-10`; // Get last 3 points over 10 seconds
        
        if (dimension) {
            url += `&dimension=${dimension}`;
        }
        
        const response = await axios.get(url, {
            timeout: 5000, // 5 second timeout
            headers: {
                'Accept': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error(`Netdata fetch error for ${chart}:`, error.message);
        return null;
    }
};

// Get network interface statistics from Netdata
const getNetworkStats = async () => {
    try {
        // Get available network interfaces from the system
        const interfaceNames = await getSystemNetworkInterfaces();
        let netData = null;
        let foundInterface = null;
        let usedChart = null;
        
        for (const iface of interfaceNames) {
            try {
                // Try different chart naming conventions in order of preference
                const possibleCharts = [
                    `net.${iface}`,        // Standard format: net.end0
                    `net_${iface}`,        // Alternative format: net_end0
                    `system.net.${iface}`, // System format
                    `proc.net.dev_${iface}` // Proc format
                ];
                
                for (const chart of possibleCharts) {
                    try {
                        netData = await fetchNetdataData('/api/v1/data', chart, null);
                        if (netData && netData.data && netData.data.length > 0) {
                            foundInterface = iface;
                            usedChart = chart;
                            break;
                        }
                    } catch (err) {
                        // Continue to next chart format
                        continue;
                    }
                }
                
                if (netData && netData.data && netData.data.length > 0) {
                    break; // Found working interface
                }
            } catch (err) {
                continue; // Try next interface
            }
        }
        
        if (!netData || !netData.data || netData.data.length === 0) {
            return null;
        }
        
        const latestData = netData.data[0];
        const labels = netData.labels;
        
        // Find received and sent bytes indexes
        const receivedIndex = labels.findIndex(label => 
            label.includes('received') || label.includes('in') || label.includes('download')
        );
        const sentIndex = labels.findIndex(label => 
            label.includes('sent') || label.includes('out') || label.includes('upload')
        );
        
        // Get the actual values and ensure they're positive numbers
        let downloadRate = 0;
        let uploadRate = 0;
        
        if (receivedIndex >= 0 && latestData[receivedIndex] !== null && receivedIndex < latestData.length) {
            downloadRate = Math.abs(parseFloat(latestData[receivedIndex])) || 0;
        }
        
        if (sentIndex >= 0 && latestData[sentIndex] !== null && sentIndex < latestData.length) {
            uploadRate = Math.abs(parseFloat(latestData[sentIndex])) || 0;
        }
        
        // Convert timestamp (Netdata uses seconds, we want milliseconds)
        const timestamp = latestData[0] ? latestData[0] * 1000 : Date.now();
        
        const networkStats = {
            interfaces: [foundInterface],
            download: downloadRate,
            upload: uploadRate,
            timestamp: timestamp,
            source: 'netdata',
            activeInterface: foundInterface,
            labels: labels,
            chartUsed: usedChart
        };
        
        return networkStats;
    } catch (error) {
        console.error('Network stats error:', error);
        return null;
    }
};

// Get detailed network interface information
const getNetworkInterfaces = async () => {
    try {
        // Get available network interfaces from the system
        const systemInterfaces = await getSystemNetworkInterfaces();
        
        // Try to get interface list from Netdata charts
        const netdataUrl = process.env.NETDATA_URL || 'http://localhost:19999';
        const chartsResponse = await axios.get(`${netdataUrl}/api/v1/charts`, {
            timeout: 5000,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const chartsData = chartsResponse.data;
        const networkCharts = Object.keys(chartsData.charts).filter(chart => 
            (chart.startsWith('net.') || chart.startsWith('net_')) && !chart.includes('_dup')
        );
        
        const interfaces = [];
        
        // Try only the interfaces we discovered from the system
        for (const interfaceName of systemInterfaces) {
            // Try different chart naming conventions in order of preference
            const possibleCharts = [
                `net.${interfaceName}`,        // Standard format: net.end0
                `net_${interfaceName}`,        // Alternative format: net_end0
                `system.net.${interfaceName}`, // System format
                `proc.net.dev_${interfaceName}` // Proc format
            ];
            
            let interfaceData = null;
            let usedChart = null;
            
            for (const chart of possibleCharts) {
                if (networkCharts.includes(chart)) {
                    try {
                        interfaceData = await fetchNetdataData('/api/v1/data', chart);
                        if (interfaceData && interfaceData.data && interfaceData.data.length > 0) {
                            usedChart = chart;
                            break;
                        }
                    } catch (err) {
                        continue; // Try next chart format
                    }
                }
            }
            
            if (interfaceData && interfaceData.data && interfaceData.data.length > 0) {
                const latestData = interfaceData.data[0];
                const labels = interfaceData.labels;
                
                const receivedIndex = labels.findIndex(label => 
                    label.includes('received') || label.includes('in')
                );
                const sentIndex = labels.findIndex(label => 
                    label.includes('sent') || label.includes('out')
                );
                
                let received = 0;
                let sent = 0;
                
                if (receivedIndex >= 0 && latestData[receivedIndex] !== null && receivedIndex < latestData.length) {
                    received = Math.abs(parseFloat(latestData[receivedIndex])) || 0;
                }
                
                if (sentIndex >= 0 && latestData[sentIndex] !== null && sentIndex < latestData.length) {
                    sent = Math.abs(parseFloat(latestData[sentIndex])) || 0;
                }
                
                interfaces.push({
                    name: interfaceName,
                    received: received,
                    sent: sent,
                    active: true,
                    chart: usedChart
                });
            }
        }
        
        return interfaces;
    } catch (error) {
        console.error('Network interfaces error:', error);
        return [];
    }
};

// Get available network interfaces from system (returns cached interfaces)
const getSystemNetworkInterfaces = async () => {
    return systemNetworkInterfaces;
};

// Discover network interfaces at startup
const discoverNetworkInterfaces = async () => {
    return new Promise((resolve) => {
        exec('ip a', (error, stdout) => {
            if (error) {
                console.error('Failed to get network interfaces:', error.message);
                systemNetworkInterfaces = [];
                resolve(systemNetworkInterfaces);
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
            
            systemNetworkInterfaces = interfaces.length > 0 ? interfaces : ['eth0']; // Fallback to eth0 if none found
            
            console.log(`Discovered network interfaces: ${systemNetworkInterfaces.join(', ')}`);
            resolve(systemNetworkInterfaces);
        });
    });
};

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Initialize
(async () => {
    // Load settings
    loadSettings();
    
    // Create default admin user
    await createDefaultUser();
    
    // Start server
    app.listen(port, '0.0.0.0', () => {
        console.log(`Homelab API Server running on http://0.0.0.0:${port}`);
        console.log(`Database path: ${path.join(__dirname, 'data', 'homelab.db')}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Authentication: Enabled (admin/password)`);
        console.log(`Security: Environment variables loaded ✓`);
        
        // Initial scan after startup
        (async () => {
            console.log('Performing initial device scan...');
            try {
                // Discover network interfaces once at startup
                await discoverNetworkInterfaces();
                
                const devices = await scanAndUpdateDevices();
                const savedDevices = devices.filter(d => d.isSaved);
                const onlineDevices = devices.filter(d => d.status === 'online');
                
                console.log(`Initial scan completed: ${devices.length} devices found (${savedDevices.length} saved, ${onlineDevices.length} online)`);
                
                // Log configured saved devices
                if (savedDevices.length > 0) {
                    console.log(`Saved devices: ${savedDevices.map(d => d.name || d.mac).join(', ')}`);
                } else {
                    console.log('No saved devices configured');
                }
            } catch (error) {
                console.error('Initial scan failed:', error.message);
            }
        })();
    });
})();


