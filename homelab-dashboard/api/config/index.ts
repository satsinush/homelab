import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { getEnv } from '../utils/env';
import * as client from 'openid-client';

const SESSION_SECRET = getEnv('HOMELAB_API_SESSION_SECRET');
const DASHBOARD_OIDC_SECRET = getEnv('DASHBOARD_OIDC_SECRET');

if (!SESSION_SECRET) {
    console.error('ERROR: SESSION_SECRET environment variable or HOMELAB_API_SESSION_SECRET_FILE is required!');
    console.error('Please set HOMELAB_API_SESSION_SECRET or HOMELAB_API_SESSION_SECRET_FILE.');
    process.exit(1);
}

if (!DASHBOARD_OIDC_SECRET) {
    console.error('ERROR: DASHBOARD_OIDC_SECRET environment variable or DASHBOARD_OIDC_SECRET_FILE is required!');
    console.error('Please set DASHBOARD_OIDC_SECRET or DASHBOARD_OIDC_SECRET_FILE.');
    process.exit(1);
}

const homelabHostname = process.env.HOMELAB_HOSTNAME || '';
const dashboardServiceName = process.env.DASHBOARD_SERVICE_NAME || 'dashboard';
const authentikServiceName = process.env.AUTHENTIK_SERVICE_NAME || 'authentik';
const piholeServiceName = process.env.PIHOLE_SERVICE_NAME || 'pihole';
const dockhandServiceName = process.env.DOCKHAND_SERVICE_NAME || 'dockhand';
const vaultwardenServiceName = process.env.VAULTWARDEN_SERVICE_NAME || 'vaultwarden';
const gatusServiceName = process.env.GATUS_SERVICE_NAME || 'gatus';
const gotifyServiceName = process.env.GOTIFY_SERVICE_NAME || 'gotify';

const DASHBOARD_WEB_HOSTNAME = `${dashboardServiceName}.${homelabHostname}`;
const AUTHENTIK_WEB_HOSTNAME = `${authentikServiceName}.${homelabHostname}`;
const PIHOLE_WEB_HOSTNAME = `${piholeServiceName}.${homelabHostname}`;
const DOCKHAND_WEB_HOSTNAME = `${dockhandServiceName}.${homelabHostname}`;
const VAULTWARDEN_WEB_HOSTNAME = `${vaultwardenServiceName}.${homelabHostname}`;
const GATUS_WEB_HOSTNAME = `${gatusServiceName}.${homelabHostname}`;
const GOTIFY_WEB_HOSTNAME = `${gotifyServiceName}.${homelabHostname}`;

export interface DefaultSettings {
    scanTimeout: number;
    cacheTimeout: number;
    packageUpdateCheck: {
        enabled: boolean;
        intervalHours: number;
        notificationIntervalHours: number;
    };
}

const DEFAULT_SETTINGS: DefaultSettings = {
    scanTimeout: 30000,
    cacheTimeout: 300000,
    packageUpdateCheck: {
        enabled: true,
        intervalHours: 1,
        notificationIntervalHours: 6
    }
};

let oidcConfig: client.Configuration | null = null;
let initializationPromise: Promise<client.Configuration> | null = null;

async function initializeOIDCClient(): Promise<client.Configuration> {
    if (initializationPromise) {
        return initializationPromise;
    }

    if (oidcConfig) {
        return oidcConfig;
    }

    initializationPromise = (async () => {
        try {
            const server = new URL(`https://${AUTHENTIK_WEB_HOSTNAME}/application/o/homelab-dashboard/`);
            const clientId = 'homelab_dashboard';
            const clientSecret = DASHBOARD_OIDC_SECRET!;

            oidcConfig = await client.discovery(
                server,
                clientId,
                undefined,
                client.ClientSecretBasic(clientSecret)
            );

            console.log('OIDC Configuration initialized successfully');
            return oidcConfig;
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to initialize OIDC client:', error);
            console.error('Error details:', err.message);
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
}

async function getOIDCConfig(): Promise<client.Configuration> {
    if (!oidcConfig) {
        await initializeOIDCClient();
    }
    return oidcConfig as client.Configuration;
}

const config = {
    port: 5000,
    sessionSecret: SESSION_SECRET,
    database: {
        path: path.join(__dirname, '..', 'data'),
        filename: 'homelab.db'
    },
    cors: {
        origins: [
            'http://localhost:5173',
            `https://${DASHBOARD_WEB_HOSTNAME}`,
            `http://${DASHBOARD_WEB_HOSTNAME}`,
        ]
    },
    rateLimit: {
        windowMs: process.env.ENVIRONMENT === 'development' ? 1000 : 10 * 60 * 1000,
        max: process.env.ENVIRONMENT === 'development' ? 1 : 10
    },
    session: {
        secure: process.env.ENVIRONMENT === 'development' ? false : true,
        httpOnly: true,
        sameSite: 'lax' as const,
        maxAge: 24 * 60 * 60 * 1000
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
    dashBoardWebHostname: DASHBOARD_WEB_HOSTNAME,
    authentikWebHostname: AUTHENTIK_WEB_HOSTNAME,
    homelabHostname: homelabHostname,
    rustdeskPubKeyPath: process.env.RUSTDESK_PUBKEY_PATH || '',
    disableLocalAuth: (process.env.DISABLE_LOCAL_AUTH ?? 'true') === 'true',
    piholeWebHostname: PIHOLE_WEB_HOSTNAME,
    dockhandWebHostname: DOCKHAND_WEB_HOSTNAME,
    vaultwardenWebHostname: VAULTWARDEN_WEB_HOSTNAME,
    gatusWebHostname: GATUS_WEB_HOSTNAME,
    gotifyWebHostname: GOTIFY_WEB_HOSTNAME,
    ssoEnabled: !!DASHBOARD_OIDC_SECRET,
    defaultSettings: DEFAULT_SETTINGS,
    getOIDCConfig: getOIDCConfig,
    oidcLib: client
};

export default config;
