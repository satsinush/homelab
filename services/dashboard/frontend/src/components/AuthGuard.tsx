import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/useAuth';
import LoginChoice from './LoginChoice';
import { ReactNode } from 'react';

interface AuthGuardProps {
    children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
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
        return <LoginChoice />;
    }

    return children;
};

export default AuthGuard;
