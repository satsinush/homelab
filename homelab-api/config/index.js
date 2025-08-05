// Load environment variables first
require('dotenv').config();

const path = require('path');

// Validate required environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

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
    cacheTimeout: 300000
};

const config = {
    port: process.env.PORT || 5000,
    jwtSecret: JWT_SECRET,
    sessionSecret: SESSION_SECRET,
    database: {
        path: path.join(__dirname, '..', 'data'),
        filename: 'homelab.db'
    },
    cors: {
        origins: [
            'http://localhost:5173',  // Vite dev server
            'http://localhost:3000',  // React dev server
            'https://admin.rpi5-server.home.arpa',  // Production domain
            'http://admin.rpi5-server.home.arpa',   // HTTP version
            'http://10.10.10.10',    // Direct IP access
            'https://10.10.10.10'    // HTTPS IP access
        ]
    },
    rateLimit: {
        windowMs: 1000, // 1 second
        max: process.env.NODE_ENV === 'development' ? 1 : 1
    },
    session: {
        secure: process.env.NODE_ENV === 'development' ? false : true, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    netdata: {
        url: process.env.NETDATA_URL || 'http://localhost:19999'
    },
    ollama:{
        url: process.env.OLLAMA_URL || 'http://localhost:11434'
    },
    defaultSettings: DEFAULT_SETTINGS
};

module.exports = config;
