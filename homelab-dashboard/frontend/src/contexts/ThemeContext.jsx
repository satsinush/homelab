// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

const ThemeContext = createContext();

export const useThemeMode = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeModeProvider = ({ children }) => {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [themeMode, setThemeMode] = useState(() => {
        const saved = localStorage.getItem('themeMode');
        return saved || 'device';
    });

    // Determine actual mode based on setting
    const getActualMode = () => {
        if (themeMode === 'device') {
            return prefersDarkMode ? 'dark' : 'light';
        }
        return themeMode;
    };

    const actualMode = getActualMode();

    useEffect(() => {
        localStorage.setItem('themeMode', themeMode);
    }, [themeMode]);

    const lightTheme = createTheme({
        palette: {
            mode: 'light',
            primary: {
                main: '#3b82f6',
            },
            secondary: {
                main: '#10b981',
            },
            background: {
                default: '#f8fafc',
                paper: '#ffffff',
            },
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
        breakpoints: {
            values: {
                xs: 0,
                sm: 600,
                md: 960,
                lg: 1280,
                xl: 1920,
            },
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none',
                        fontWeight: 500,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 12,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
                        backgroundColor: '#ffffff',
                    },
                },
            },
            MuiCssBaseline: {
                styleOverrides: {
                    '*::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '*::-webkit-scrollbar-track': {
                        background: '#f1f5f9',
                        borderRadius: '4px',
                    },
                    '*::-webkit-scrollbar-thumb': {
                        background: '#cbd5e1',
                        borderRadius: '4px',
                        '&:hover': {
                            background: '#94a3b8',
                        },
                    },
                    '*::-webkit-scrollbar-corner': {
                        background: '#f1f5f9',
                    },
                },
            },
        },
    });

    const darkTheme = createTheme({
        palette: {
            mode: 'dark',
            primary: {
                main: '#60a5fa',
            },
            secondary: {
                main: '#34d399',
            },
            background: {
                default: '#0f172a',
                paper: '#1e293b',
            },
            text: {
                primary: '#f1f5f9',
                secondary: '#cbd5e1',
            },
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
        breakpoints: {
            values: {
                xs: 0,
                sm: 600,
                md: 960,
                lg: 1280,
                xl: 1920,
            },
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none',
                        fontWeight: 500,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 12,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                        backgroundColor: '#1e293b',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#1e293b',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: '#1e293b',
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#60a5fa',
                    },
                },
            },
            MuiCssBaseline: {
                styleOverrides: {
                    '*::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '*::-webkit-scrollbar-track': {
                        background: '#0f172a',
                        borderRadius: '4px',
                    },
                    '*::-webkit-scrollbar-thumb': {
                        background: '#475569',
                        borderRadius: '4px',
                        '&:hover': {
                            background: '#64748b',
                        },
                    },
                    '*::-webkit-scrollbar-corner': {
                        background: '#0f172a',
                    },
                },
            },
        },
    });

    const theme = actualMode === 'dark' ? darkTheme : lightTheme;

    const value = {
        themeMode,
        setThemeMode,
        actualMode,
        theme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
