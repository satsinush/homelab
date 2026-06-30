// Load environment variables first
require('dotenv').config();

const path = require('path');
const https = require('https');

// Import openid-client following official documentation
const client = require('openid-client');
const { url } = require('inspector');

// Validate required environment variables
const SESSION_SECRET = process.env.HOMELAB_API_SESSION_SECRET;
const DASHBOARD_OIDC_SECRET = process.env.DASHBOARD_OIDC_SECRET;

if (!SESSION_SECRET) {
    console.error('ERROR: SESSION_SECRET environment variable is required!');
    console.error('Please set HOMELAB_API_SESSION_SECRET in your .env file or environment variables.');
    process.exit(1);
}

if (!DASHBOARD_OIDC_SECRET) {
    console.error('ERROR: DASHBOARD_OIDC_SECRET environment variable is required!');
    console.error('Please set DASHBOARD_OIDC_SECRET in your .env file or environment variables.');
    process.exit(1);
}

// Default server settings
const DEFAULT_SETTINGS = {
    scanTimeout: 30000,
    cacheTimeout: 300000,
    packageUpdateCheck: {
        enabled: true,
        intervalHours: 1,
        notificationIntervalHours: 6
    }
};

// OIDC Client setup using openid-client library
let oidcConfig = null;
let initializationPromise = null;

async function initializeOIDCClient() {
    // If already initializing, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }

    // If already initialized, return the config
    if (oidcConfig) {
        return oidcConfig;
    }

    initializationPromise = (async () => {
        try {
            // Set up the OIDC configuration following official documentation
            const server = new URL(`https://${process.env.AUTHENTIK_WEB_HOSTNAME}/application/o/homelab-dashboard/`);
            const clientId = 'homelab_dashboard';
            const clientSecret = process.env.DASHBOARD_OIDC_SECRET;

            oidcConfig = await client.discovery(
                server,
                clientId,
                undefined, // clientMetadata
                client.ClientSecretBasic(clientSecret)
            );

            console.log('OIDC Configuration initialized successfully');

            return oidcConfig;

        } catch (error) {
            console.error('Failed to initialize OIDC client:', error);
            console.error('Error details:', error.message);
            // Reset the promise so we can try again later
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
}

// Function to get OIDC config, initializing if needed
async function getOIDCConfig() {
    if (!oidcConfig) {
        await initializeOIDCClient();
    }
    return oidcConfig;
}

// Don't initialize automatically at startup - wait for first SSO login attempt

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
        sameSite: 'lax',
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
    apprise: {
        url: 'http://apprise-api'
    },
    dashBoardWebHostname: process.env.DASHBOARD_WEB_HOSTNAME,
    authentikWebHostname: process.env.AUTHENTIK_WEB_HOSTNAME,
    homelabHostname: process.env.HOMELAB_HOSTNAME,
    rustdeskPubKeyPath: process.env.RUSTDESK_PUBKEY_PATH,
    disableLocalAuth: process.env.DISABLE_LOCAL_AUTH === 'true',
    piholeWebHostname: process.env.PIHOLE_WEB_HOSTNAME,
    netdataWebHostname: process.env.NETDATA_WEB_HOSTNAME,
    portainerWebHostname: process.env.PORTAINER_WEB_HOSTNAME,
    dockgeWebHostname: process.env.DOCKGE_WEB_HOSTNAME,
    dockhandWebHostname: process.env.DOCKHAND_WEB_HOSTNAME,
    vaultwardenWebHostname: process.env.VAULTWARDEN_WEB_HOSTNAME,
    uptimeKumaWebHostname: process.env.UPTIME_KUMA_WEB_HOSTNAME,
    gotifyWebHostname: process.env.GOTIFY_WEB_HOSTNAME,
    defaultSettings: DEFAULT_SETTINGS,
    getOIDCConfig: getOIDCConfig,
    oidcLib: client
};

module.exports = config;
