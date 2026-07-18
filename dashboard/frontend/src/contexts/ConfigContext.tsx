// src/contexts/ConfigContext.tsx
import React, { useState, useEffect, ReactNode } from 'react';
import { tryApiCall } from '../utils/api';
import { ConfigResponse } from '../types/api';
import { ConfigContext, AppConfig } from './ConfigContextCore';

interface ConfigProviderProps {
    children: ReactNode;
}

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
    const [config, setConfig] = useState<AppConfig>({
        disableLocalAuth: false,
        ssoEnabled: false,
        hostnames: {
            dashboard: '',
            pihole: '',
            dockhand: '',
            vaultwarden: '',
            gatus: '',
            gotify: '',
            authentik: '',
            dav: '',
            cal: ''
        },
        homelabHostname: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const result = await tryApiCall<ConfigResponse>('/config');
                if (result.data) {
                    const d = result.data;
                    setConfig({
                        disableLocalAuth: d.disableLocalAuth || false,
                        ssoEnabled: d.ssoEnabled || false,
                        hostnames: {
                            dashboard: d.dashboardWebHostname || '',
                            pihole: d.piholeWebHostname || '',
                            dockhand: d.dockhandWebHostname || '',
                            vaultwarden: d.vaultwardenWebHostname || '',
                            gatus: d.gatusWebHostname || '',
                            gotify: d.gotifyWebHostname || '',
                            authentik: d.authentikWebHostname || '',
                            dav: d.davWebHostname || '',
                            cal: d.calWebHostname || ''
                        },
                        homelabHostname: d.homelabHostname || ''
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
