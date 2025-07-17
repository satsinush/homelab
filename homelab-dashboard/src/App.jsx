// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import Navigation from './components/Navigation';
import Home from './components/Home';
import System from './components/System';
import Devices from './components/Devices';
import Chat from './components/Chat';
import PackageManager from './components/PackageManager';
import Settings from './components/Settings';
import Profile from './components/Profile';
import './App.css';

function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useThemeMode();
  const location = useLocation();

  // Get current tab from URL path
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/home') return 'home';
    if (path === '/system') return 'system';
    if (path === '/devices') return 'devices';
    if (path === '/chat') return 'chat';
    if (path === '/packages') return 'packages';
    if (path === '/settings') return 'settings';
    if (path === '/profile') return 'profile';
    return 'home';
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthGuard>
          <Box sx={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
            <Navigation
              activeTab={getCurrentTab()}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                bgcolor: 'background.default',
                minHeight: '100vh',
                width: '100%', // Ensure main content fills available space
                mt: { xs: '64px', md: 0 }, // Add top margin on mobile for app bar
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
                <Route path="/system" element={<System />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/packages" element={<PackageManager />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </Box>
          </Box>
        </AuthGuard>
      </NotificationProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;