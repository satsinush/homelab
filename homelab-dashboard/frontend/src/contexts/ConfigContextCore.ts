import { createContext } from 'react';

export interface AppConfig {
    disableLocalAuth: boolean;
    ssoEnabled: boolean;
    hostnames: {
        pihole: string;
        dockhand: string;
        vaultwarden: string;
        gatus: string;
        gotify: string;
        rustdesk: string;
        authentik: string;
    };
}

export interface ConfigContextType {
    config: AppConfig;
    loading: boolean;
}

export const ConfigContext = createContext<ConfigContextType | null>(null);
