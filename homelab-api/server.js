// Simplified Homelab API Server - WOL Dashboard with Authentication
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
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 5000;

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
    CREATE TABLE IF NOT EXISTS wol_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mac TEXT NOT NULL UNIQUE,
        description TEXT,
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
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
`);

// Authentication constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production';

// Default server settings
const DEFAULT_SETTINGS = {
    networkSubnet: '10.10.10.0/24',
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

// Device cache
let deviceCache = {
    devices: [],
    lastScan: null,
    scanInProgress: false
};

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

// Create session
const createSession = (userId) => {
    try {
        const sessionId = uuidv4();
        const token = jwt.sign(
            { 
                userId, 
                sessionId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
            },
            JWT_SECRET
        );
        
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
        
        const stmt = db.prepare(`
            INSERT INTO sessions (id, user_id, token, expires_at) 
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run(sessionId, userId, token, expiresAt.toISOString());
        
        return { sessionId, token, expiresAt };
    } catch (error) {
        console.error('Session creation error:', error);
        return null;
    }
};

// Verify session
const verifySession = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const stmt = db.prepare(`
            SELECT s.*, u.username, u.roles 
            FROM sessions s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
        `);
        
        const session = stmt.get(decoded.sessionId);
        
        if (!session) {
            return null;
        }
        
        return {
            userId: session.user_id,
            username: session.username,
            roles: JSON.parse(session.roles),
            sessionId: session.id
        };
    } catch (error) {
        console.error('Session verification error:', error);
        return null;
    }
};

// Delete session
const deleteSession = (sessionId) => {
    try {
        const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
        return stmt.run(sessionId);
    } catch (error) {
        console.error('Session deletion error:', error);
        return null;
    }
};

// Clean expired sessions
const cleanExpiredSessions = () => {
    try {
        const stmt = db.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
        const result = stmt.run();
        if (result.changes > 0) {
            console.log(`Cleaned ${result.changes} expired sessions`);
        }
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
};

// Authentication middleware
const requireAuth = (requiredRole = null) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const session = verifySession(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        // Check role if specified
        if (requiredRole && !session.roles.includes(requiredRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.user = session;
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

// Get WOL devices from database
const getWolDevices = () => {
    try {
        const stmt = db.prepare('SELECT * FROM wol_devices ORDER BY name');
        const devices = stmt.all();
        return devices.map(device => ({
            _id: device.id,
            name: device.name,
            mac: device.mac,
            description: device.description,
            createdAt: device.created_at,
            updatedAt: device.updated_at
        }));
    } catch (error) {
        console.error('Error getting WOL devices:', error);
        return [];
    }
};

// Add or update WOL device
const saveWolDevice = (device) => {
    try {
        if (device._id) {
            // Update existing device
            const stmt = db.prepare('UPDATE wol_devices SET name = ?, mac = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            const result = stmt.run(device.name, device.mac, device.description, device._id);
            return result.changes;
        } else {
            // Insert new device
            const stmt = db.prepare('INSERT INTO wol_devices (name, mac, description) VALUES (?, ?, ?)');
            const result = stmt.run(device.name, device.mac, device.description);
            return { _id: result.lastInsertRowid, ...device };
        }
    } catch (error) {
        console.error('Error saving WOL device:', error);
        throw error;
    }
};

// Delete WOL device
const deleteWolDevice = (deviceId) => {
    try {
        const stmt = db.prepare('DELETE FROM wol_devices WHERE id = ?');
        const result = stmt.run(deviceId);
        return result.changes;
    } catch (error) {
        console.error('Error deleting WOL device:', error);
        throw error;
    }
};

// ARP scan to find devices on network
const scanForDevices = async () => {
    const wolDevices = getWolDevices();
    
    return new Promise((resolve) => {
        const cmd = `arp-scan ${serverSettings.networkSubnet}`;
        exec(cmd, { timeout: serverSettings.scanTimeout }, (error, stdout, stderr) => {
            if (error) {
                console.error('ARP scan error:', error.message);
                resolve([]);
                return;
            }

            // Parse ARP scan output
            const arpEntries = new Map();
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.+)$/);
                if (match) {
                    const [, ip, mac, vendor] = match;
                    const normalizedMac = mac.toUpperCase().replace(/:/g, '-');
                    arpEntries.set(normalizedMac, { ip, vendor: vendor.trim() });
                }
            }
            
            // Create device list from WOL configuration
            const devices = wolDevices.map(wolDevice => {
                const normalizedMac = wolDevice.mac.toUpperCase().replace(/:/g, '-');
                const arpEntry = arpEntries.get(normalizedMac);
                
                return {
                    _id: wolDevice._id,
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

// Main scan function
const performScan = async () => {
    if (deviceCache.scanInProgress) {
        console.log('Scan already in progress...');
        return deviceCache.devices;
    }

    deviceCache.scanInProgress = true;
    console.log('Starting ARP scan...');
    
    try {
        const devices = await scanForDevices();
        
        deviceCache.devices = devices;
        deviceCache.lastScan = Date.now();
        deviceCache.scanInProgress = false;
        
        console.log(`Scan completed: ${devices.length} devices (${devices.filter(d => d.ip).length} online)`);
        return devices;
        
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
        return await performScan();
    }
    
    return deviceCache.devices;
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
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 1 : 60, // Stricter in production
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Session configuration
app.use(session({
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
        
        const session = createSession(user.id);
        
        if (!session) {
            return res.status(500).json({ error: 'Failed to create session' });
        }
        
        // Store token in session
        req.session.token = session.token;
        req.session.userId = user.id;
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                roles: user.roles
            },
            token: session.token,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
        
        if (token) {
            const session = verifySession(token);
            if (session) {
                deleteSession(session.sessionId);
            }
        }
        
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
        });
        
        res.json({ message: 'Logout successful' });
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
        
        const session = verifySession(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        res.json({
            valid: true,
            user: {
                id: session.userId,
                username: session.username,
                roles: session.roles
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
        
        // If password was changed, we need to keep the current session but invalidate others
        if (newPassword) {
            // Keep only the current session active, invalidate all others
            const currentSession = req.user.sessionId;
            const invalidateOtherSessionsStmt = db.prepare(`
                DELETE FROM sessions 
                WHERE user_id = ? AND id != ?
            `);
            invalidateOtherSessionsStmt.run(userId, currentSession);
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

// Wake on LAN
app.post('/api/wol', requireAuth('admin'), async (req, res) => {
    const deviceName = req.body.device;
    
    try {
        const wolDevices = getWolDevices();
        const device = wolDevices.find(d => d.name === deviceName);

        if (!device || !device.mac) {
            return res.status(400).json({ error: "Device not found or MAC address missing." });
        }

        wol.wake(device.mac, (error) => {
            if (error) {
                console.error(`WoL error for ${deviceName}:`, error);
                return res.status(500).json({ error: `Failed to send WoL packet: ${error.message}` });
            }
            res.json({ message: `WoL packet sent to ${deviceName} (${device.mac})` });
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get device info: ${error.message}` });
    }
});

// Get device status
app.get('/api/devices/status', requireAuth('admin'), async (req, res) => {
    try {
        const devices = await getDevices();
        
        // Create device status list
        const deviceStatuses = devices.map(device => ({
            ip: device.ip,
            mac: device.mac,
            vendor: device.vendor,
            friendlyName: device.friendlyName,
            deviceKey: device.deviceKey,
            networkName: device.networkName,
            networkDescription: device.networkDescription,
            wolEnabled: device.wolEnabled,
            status: device.ip ? 'online' : 'offline',
            lastSeen: device.lastSeen,
            scanMethod: device.scanMethod
        }));
        
        res.json({
            devices: deviceStatuses,
            totalDevices: deviceStatuses.length,
            onlineDevices: deviceStatuses.filter(d => d.status === 'online').length,
            wolEnabledDevices: deviceStatuses.length,
            lastScan: deviceCache.lastScan ? new Date(deviceCache.lastScan).toISOString() : null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to get device status: ${error.message}` });
    }
});

// Trigger network scan
app.post('/api/devices/scan', requireAuth('admin'), async (req, res) => {
    try {
        const devices = await performScan();
        res.json({
            message: 'Network scan completed',
            devicesFound: devices.length,
            devices: devices,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to scan network: ${error.message}` });
    }
});

// Get all WOL devices
app.get('/api/devices/wol', requireAuth('admin'), async (req, res) => {
    try {
        const devices = getWolDevices();
        res.json({ devices });
    } catch (error) {
        res.status(500).json({ error: `Failed to get WOL devices: ${error.message}` });
    }
});

// Add new WOL device
app.post('/api/devices/wol', requireAuth('admin'), async (req, res) => {
    try {
        const { name, mac, description } = req.body;
        
        if (!name || !mac) {
            return res.status(400).json({ error: 'Name and MAC address are required' });
        }

        // Validate MAC address format (allow mixed or no separators, case-insensitive)
        const macClean = mac.replace(/[^a-fA-F0-9]/g, '');
        if (macClean.length !== 12) {
            return res.status(400).json({ error: 'Invalid MAC address format' });
        }
        // Reformat to all caps and colon separator
        const macFormatted = macClean.toUpperCase().match(/.{2}/g).join(':');

        const device = {
            name: name.trim(),
            mac: macFormatted.trim(),
            description: description?.trim() || ''
        };

        const result = saveWolDevice(device);
        res.json({ message: 'WOL device added successfully', device: result });
    } catch (error) {
        res.status(500).json({ error: `Failed to add WOL device: ${error.message}` });
    }
});

// Update WOL device
app.put('/api/devices/wol/:id', requireAuth('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mac, description } = req.body;
        
        if (!name || !mac) {
            return res.status(400).json({ error: 'Name and MAC address are required' });
        }

        // Validate MAC address format
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(mac)) {
            return res.status(400).json({ error: 'Invalid MAC address format' });
        }

        const device = {
            _id: id,
            name: name.trim(),
            mac: mac.trim(),
            description: description?.trim() || ''
        };

        const result = saveWolDevice(device);
        res.json({ message: 'WOL device updated successfully', updated: result });
    } catch (error) {
        res.status(500).json({ error: `Failed to update WOL device: ${error.message}` });
    }
});

// Delete WOL device
app.delete('/api/devices/wol/:id', requireAuth('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = deleteWolDevice(id);
        
        if (result === 0) {
            return res.status(404).json({ error: 'WOL device not found' });
        }

        res.json({ message: 'WOL device deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: `Failed to delete WOL device: ${error.message}` });
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

// System information
app.get('/api/system-info', requireAuth('admin'), (req, res) => {
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
        res.json(systemInfo);
    } catch (error) {
        res.status(500).json({ error: `Failed to get system info: ${error.message}` });
    }
});

// System resources
app.get('/api/resources', requireAuth('admin'), (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        
        // Get disk usage
        exec('df /', (error, stdout) => {
            let diskInfo = { used: 0, total: 0, free: 0, percentage: 0 };
            
            if (!error) {
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                    const diskLine = lines[1].split(/\s+/);
                    const totalKB = parseInt(diskLine[1]);
                    const usedKB = parseInt(diskLine[2]);
                    const availableKB = parseInt(diskLine[3]);
                    const percentage = parseInt(diskLine[4].replace('%', ''));
                    
                    diskInfo = {
                        total: totalKB * 1024,
                        used: usedKB * 1024,
                        free: availableKB * 1024,
                        percentage: percentage,
                        filesystem: diskLine[0]
                    };
                }
            }

            res.json({
                cpu: {
                    cores: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    speed: cpus[0]?.speed || 0,
                    loadAverage: loadAvg,
                    usage: Math.round(loadAvg[0] * 100 / cpus.length)
                },
                memory: {
                    total: Math.round(totalMem),
                    used: Math.round(usedMem),
                    free: Math.round(freeMem),
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

// Temperature monitoring
app.get('/api/temperature', requireAuth('admin'), (req, res) => {
    exec('vcgencmd measure_temp', (error, stdout) => {
        if (error) {
            res.json({ 
                cpu: 'N/A',
                gpu: 'N/A',
                error: 'Temperature monitoring not available'
            });
        } else {
            const temp = stdout.trim().replace('temp=', '').replace("'C", '');
            res.json({ 
                cpu: parseFloat(temp),
                gpu: parseFloat(temp),
                unit: 'Celsius',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Service status
app.get('/api/services', requireAuth('admin'), (req, res) => {
    const services = serverSettings.services || [];

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
        res.json({
            services: serviceStatuses,
            timestamp: new Date().toISOString()
        });
    })
    .catch(error => {
        res.status(500).json({ error: `Failed to check services: ${error.message}` });
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Initialize
(async () => {
    // Load settings
    loadSettings();
    
    // Create default admin user
    await createDefaultUser();
    
    // Clean expired sessions
    cleanExpiredSessions();
    setInterval(cleanExpiredSessions, 60 * 60 * 1000); // Clean every hour
    
    // Start server
    app.listen(port, '0.0.0.0', () => {
        console.log(`Homelab API Server running on http://0.0.0.0:${port}`);
        console.log(`Database path: ${path.join(__dirname, 'data', 'homelab.db')}`);
        console.log('Authentication: Enabled (admin/password)');
        
        // Initial scan after startup
        setTimeout(async () => {
            console.log('Performing initial network scan...');
            try {
                const devices = await performScan();
                console.log(`Initial scan completed: ${devices.length} devices found`);
                
                // Log configured WOL devices
                const wolDevices = getWolDevices();
                console.log(`Configured WOL devices: ${wolDevices.map(d => d.name).join(', ') || 'None'}`);
            } catch (error) {
                console.error('Initial scan failed:', error.message);
            }
        }, 5000);
    });
})();
