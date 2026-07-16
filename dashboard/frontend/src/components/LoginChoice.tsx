// src/components/LoginChoice.tsx
import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Stack,
    Container,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Login as LoginIcon,
    Security as SecurityIcon,
    AccountCircle as AccountIcon
} from '@mui/icons-material';
import LocalLogin from './LocalLogin';
import { useConfig } from '../contexts/useConfig';

/** Sync read — must run before auto-SSO effect (useEffect would be too late). */
function initialSkipAutoSso(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return !!params.get('sso_error') || params.get('local') === '1';
}

const LoginChoice = () => {
    const [showLocalLogin, setShowLocalLogin] = useState(false);
    const [ssoError, setSsoError] = useState('');
    const [ssoLoading, setSsoLoading] = useState(false);
    const [preferLocal, setPreferLocal] = useState(false);
    const [skipAutoSso, setSkipAutoSso] = useState(initialSkipAutoSso);
    const { config, loading: configLoading } = useConfig();
    const disableLocalAuth = config.disableLocalAuth;
    const ssoEnabled = config.ssoEnabled;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('sso_error');
        if (error) {
            setSsoError(error);
            setSkipAutoSso(true);
            params.delete('sso_error');
        }
        if (params.get('local') === '1') {
            setPreferLocal(true);
            setSkipAutoSso(true);
            params.delete('local');
        }
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
    }, []);

    const handleSSOLogin = () => {
        setSsoError('');
        setSkipAutoSso(false);
        setSsoLoading(true);
        window.location.href = '/api/users/sso-login';
    };

    // Start OIDC immediately. Authentik finishes silently when a
    // session already exists; otherwise the IdP login page is shown.
    const shouldAutoSso =
        !configLoading && ssoEnabled && !skipAutoSso && !preferLocal && !showLocalLogin;

    useEffect(() => {
        if (!shouldAutoSso) return;
        setSsoLoading(true);
        window.location.href = '/api/users/sso-login';
    }, [shouldAutoSso]);

    if (showLocalLogin) {
        return <LocalLogin onBack={() => setShowLocalLogin(false)} />;
    }

    if (configLoading || shouldAutoSso || ssoLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    gap: 2
                }}
            >
                <CircularProgress size={48} />
                <Typography variant="body1" color="text.secondary">
                    {configLoading ? 'Loading…' : 'Signing in with SSO…'}
                </Typography>
            </Box>
        );
    }

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    py: 4
                }}
            >
                <Paper
                    elevation={8}
                    sx={{
                        p: 4,
                        width: '100%',
                        maxWidth: 400,
                        borderRadius: 2
                    }}
                >
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Box component="img" src="/homelab-icon.svg" alt="Homelab" sx={{ width: 64, height: 64, mb: 2 }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Homelab Dashboard
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {disableLocalAuth ? 'Sign in with your homelab account' : 'Choose your login method'}
                        </Typography>
                    </Box>

                    {ssoError && (
                        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setSsoError('')}>
                            {ssoError}
                        </Alert>
                    )}

                    <Stack spacing={3}>
                        {ssoEnabled && (
                            <Card
                                variant="outlined"
                                sx={{
                                    cursor: 'pointer',
                                    border: 2,
                                    borderColor: 'primary.main',
                                    '&:hover': {
                                        borderColor: 'primary.dark',
                                        boxShadow: 2
                                    }
                                }}
                                onClick={handleSSOLogin}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                    <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h5" gutterBottom fontWeight="bold">
                                        Sign in with SSO
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        {disableLocalAuth ? 'Use your homelab account to sign in' : 'Recommended - Use your homelab account'}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                                    <Button
                                        autoFocus
                                        variant="contained"
                                        size="large"
                                        startIcon={<LoginIcon />}
                                        onClick={handleSSOLogin}
                                        fullWidth
                                        sx={{ mx: 2, py: 1.5 }}
                                    >
                                        Continue with SSO
                                    </Button>
                                </CardActions>
                            </Card>
                        )}

                        {!disableLocalAuth && (
                            <Box sx={{ textAlign: 'center', pt: 2 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {ssoEnabled ? "Don't have SSO access?" : 'Sign in with a local account'}
                                </Typography>
                                <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<AccountIcon />}
                                    onClick={() => setShowLocalLogin(true)}
                                    color="secondary"
                                >
                                    Sign in locally instead
                                </Button>
                            </Box>
                        )}
                    </Stack>
                </Paper>
            </Box>
        </Container>
    );
};

export default LoginChoice;
