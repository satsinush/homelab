import { createContext } from 'react';

export interface Hostnames {
    dashboard: string;
    pihole: string;
    dockhand: string;
    vaultwarden: string;
    gatus: string;
    gotify: string;
    authentik: string;
    dav: string;
    cal: string;
    immich: string;
    mail: string;
    clipcascade: string;
}

export interface AppConfig {
    disableLocalAuth: boolean;
    ssoEnabled: boolean;
    hostnames: Hostnames;
    homelabHostname: string;
}

export interface ConfigContextType {
    config: AppConfig;
    loading: boolean;
}

export const ConfigContext = createContext<ConfigContextType | null>(null);
