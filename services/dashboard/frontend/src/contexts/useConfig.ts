import { useContext } from 'react';
import { ConfigContext, ConfigContextType } from './ConfigContextCore';

export const useConfig = (): ConfigContextType => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
