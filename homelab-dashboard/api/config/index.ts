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
            const server = new URL(`https://${process.env.AUTHENTIK_WEB_HOSTNAME}/application/o/homelab-dashboard/`);
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
            `https://${process.env.DASHBOARD_WEB_HOSTNAME}`,
            `http://${process.env.DASHBOARD_WEB_HOSTNAME}`,
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
    dashBoardWebHostname: process.env.DASHBOARD_WEB_HOSTNAME || '',
    authentikWebHostname: process.env.AUTHENTIK_WEB_HOSTNAME || '',
    homelabHostname: process.env.HOMELAB_HOSTNAME || '',
    rustdeskPubKeyPath: process.env.RUSTDESK_PUBKEY_PATH || '',
    disableLocalAuth: (process.env.DISABLE_LOCAL_AUTH ?? 'true') === 'true',
    piholeWebHostname: process.env.PIHOLE_WEB_HOSTNAME || '',
    dockhandWebHostname: process.env.DOCKHAND_WEB_HOSTNAME || '',
    vaultwardenWebHostname: process.env.VAULTWARDEN_WEB_HOSTNAME || '',
    gatusWebHostname: process.env.GATUS_WEB_HOSTNAME || '',
    gotifyWebHostname: process.env.GOTIFY_WEB_HOSTNAME || '',
    ssoEnabled: !!DASHBOARD_OIDC_SECRET,
    defaultSettings: DEFAULT_SETTINGS,
    getOIDCConfig: getOIDCConfig,
    oidcLib: client
};

export default config;
