// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import AuthGuard from './components/AuthGuard';
import Navigation from './components/Navigation';
import Home from './components/Home';
import System from './components/System';
import Devices from './components/Devices';
import Chat from './components/Chat';
import WordGames from './components/WordGames';
import PackageManager from './components/PackageManager';
import Settings from './components/Settings';
import Profile from './components/Profile';
import Users from './components/Users';
import Secrets from './components/Secrets';
import NotFound from './components/NotFound';
import './App.css';

function ProtectedRoute({ children, role }) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(role)) {
    return <Navigate to="/home" replace />;
  }
  
  return children;
}

function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useThemeMode();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { loading: configLoading } = useConfig();

  // Get current tab from URL path
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/home') return 'home';
    if (path === '/system') return 'system';
    if (path === '/devices') return 'devices';
    if (path === '/chat') return 'chat';
    if (path === '/wordgames') return 'wordgames';
    if (path === '/packages') return 'packages';
    if (path === '/users') return 'users';
    if (path === '/secrets') return 'secrets';
    if (path === '/settings') return 'settings';
    if (path === '/profile') return 'profile';
    return 'home';
  };

  const protectedPaths = [
    '/',
    '/home',
    '/system',
    '/devices',
    '/chat',
    '/wordgames',
    '/packages',
    '/users',
    '/secrets',
    '/settings',
    '/profile'
  ];

  const isProtected = protectedPaths.includes(location.pathname);

  if (authLoading || configLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Loading...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // If the user is not logged in and is visiting an invalid (404) path, show NotFound without login requirement or Navigation
  if (!isAuthenticated && !isProtected) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotFound />
      </ThemeProvider>
    );
  }

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
                <Route path="/system" element={<ProtectedRoute role="dashboard-system-user"><System /></ProtectedRoute>} />
                <Route path="/devices" element={<ProtectedRoute role="dashboard-devices-user"><Devices /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute role="dashboard-chat-user"><Chat /></ProtectedRoute>} />
                <Route path="/wordgames" element={<ProtectedRoute role="dashboard-wordgames-user"><WordGames /></ProtectedRoute>} />
                <Route path="/packages" element={<ProtectedRoute role="dashboard-packages-user"><PackageManager /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute role="dashboard-users-user"><Users /></ProtectedRoute>} />
                <Route path="/secrets" element={<ProtectedRoute role="dashboard-secrets-user"><Secrets /></ProtectedRoute>} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
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
      <ConfigProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ConfigProvider>
    </ThemeModeProvider>
  );
}

export default App;