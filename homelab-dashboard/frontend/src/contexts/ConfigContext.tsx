// src/contexts/ConfigContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tryApiCall } from '../utils/api';

export interface AppConfig {
    disableLocalAuth: boolean;
    ssoEnabled: boolean;
    hostnames: {
        pihole: string;
        dockhand: string;
        vaultwarden: string;
        gatus: string;
        gotify: string;
        authentik: string;
    };
}

interface ConfigContextType {
    config: AppConfig;
    loading: boolean;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};

interface ConfigProviderProps {
    children: ReactNode;
}

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
    const [config, setConfig] = useState<AppConfig>({
        disableLocalAuth: false,
        ssoEnabled: false,
        hostnames: {
            pihole: '',
            dockhand: '',
            vaultwarden: '',
            gatus: '',
            gotify: '',
            authentik: ''
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const result = await tryApiCall('/config');
                if (result.data) {
                    const d = result.data;
                    setConfig({
                        disableLocalAuth: d.disableLocalAuth || false,
                        ssoEnabled: d.ssoEnabled || false,
                        hostnames: {
                            pihole: d.piholeWebHostname || '',
                            dockhand: d.dockhandWebHostname || '',
                            vaultwarden: d.vaultwardenWebHostname || '',
                            gatus: d.gatusWebHostname || '',
                            gotify: d.gotifyWebHostname || '',
                            authentik: d.authentikWebHostname || ''
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to load dynamic configuration:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    return (
        <ConfigContext.Provider value={{ config, loading }}>
            {children}
        </ConfigContext.Provider>
    );
};
