import { createContext } from 'react';

export interface Hostnames {
    dashboard: string;
    pihole: string;
    dockhand: string;
    vaultwarden: string;
    gatus: string;
    gotify: string;
    authentik: string;
}

export interface AppConfig {
    disableLocalAuth: boolean;
    ssoEnabled: boolean;
    hostnames: Hostnames;
}

export interface ConfigContextType {
    config: AppConfig;
    loading: boolean;
}

export const ConfigContext = createContext<ConfigContextType | null>(null);
