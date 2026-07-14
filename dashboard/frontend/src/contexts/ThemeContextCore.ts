import { createContext } from 'react';
import { Theme } from '@mui/material/styles';

export interface ThemeContextType {
    themeMode: string;
    setThemeMode: React.Dispatch<React.SetStateAction<string>>;
    actualMode: 'light' | 'dark';
    theme: Theme;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);
