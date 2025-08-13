// src/components/AuthGuard.jsx
import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';

const AuthGuard = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    // background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
            >
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" color="white">
                    Loading...
                </Typography>
            </Box>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    return children;
};

export default AuthGuard;
