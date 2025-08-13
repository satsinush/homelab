// Load environment variables first
require('dotenv').config();

const path = require('path');

// Validate required environment variables
const SESSION_SECRET = process.env.HOMELAB_API_SESSION_SECRET;

if (!SESSION_SECRET) {
    console.error('ERROR: SESSION_SECRET environment variable is required!');
    console.error('Please set HOMELAB_API_SESSION_SECRET in your .env file or environment variables.');
    process.exit(1);
}

// Default server settings
const DEFAULT_SETTINGS = {
    scanTimeout: 30000,
    cacheTimeout: 300000
};

const config = {
    port: 5000,
    sessionSecret: SESSION_SECRET,
    database: {
        path: path.join(__dirname, '..', 'data'),
        filename: 'homelab.db'
    },
    cors: {
        origins: [
            'http://localhost:5173',  // Vite dev server
            `https://${process.env.DASHBOARD_WEB_HOSTNAME}`,  // Production domain
            `http://${process.env.DASHBOARD_WEB_HOSTNAME}`,   // HTTP version
        ]
    },
    rateLimit: {
        // 1 login attempt per second in development, 10 attempts per 10 minutes in production
        windowMs: process.env.ENVIRONMENT === 'development' ? 1000 : 10 * 60 * 1000,
        max: process.env.ENVIRONMENT === 'development' ? 1 : 10
    },
    session: {
        secure: process.env.ENVIRONMENT === 'development' ? false : true, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    netdata: {
        url: `http://netdata:19999`
    },
    ollama: {
        url: `http://ollama:11434`
    },
    hostApi: {
        url: `http://host.docker.internal:5001`
    },
    defaultSettings: DEFAULT_SETTINGS
};

module.exports = config;
