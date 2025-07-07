// src/App.jsx
import React, { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, useMediaQuery } from '@mui/material';
import Navigation from './components/Navigation';
import System from './components/System';
import Devices from './components/Devices';
import PackageManager from './components/PackageManager';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('system');
  const [mobileOpen, setMobileOpen] = useState(false);

  const theme = createTheme({
    palette: {
      primary: {
        main: '#3b82f6',
      },
      secondary: {
        main: '#10b981',
      },
      background: {
        default: '#f8fafc',
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
    },
  });

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'system':
      case 'dashboard': // Backward compatibility
      case 'resources': // Backward compatibility
        return <System />;
      case 'devices':
      case 'wol': // Backward compatibility
        return <Devices />;
      case 'packages':
        return <PackageManager />;
      case 'settings':
        return <Settings />;
      default:
        return <System />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            minHeight: '100vh',
            width: { xs: '100%', md: `calc(100% - 280px)` },
            mt: { xs: '64px', md: 0 }, // Add top margin on mobile for app bar
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderActiveComponent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;