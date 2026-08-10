import { useContext } from 'react';
import { ThemeContext, ThemeContextType } from './ThemeContextCore';

export const useThemeMode = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within a ThemeProvider');
    }
    return context;
};
