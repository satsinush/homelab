// src/components/LoginChoice.jsx
import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Stack,
    Container
} from '@mui/material';
import {
    Login as LoginIcon,
    Security as SecurityIcon,
    AccountCircle as AccountIcon
} from '@mui/icons-material';
import LocalLogin from './LocalLogin';
import { useConfig } from '../contexts/useConfig';

const LoginChoice = () => {
    const [showLocalLogin, setShowLocalLogin] = useState(false);
    const { config } = useConfig();
    const disableLocalAuth = config.disableLocalAuth;

    const handleSSOLogin = () => {
        window.location.href = '/api/users/sso-login';
    };

    if (showLocalLogin) {
        return <LocalLogin onBack={() => setShowLocalLogin(false)} />;
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

                    <Stack spacing={3}>
                        {/* Primary SSO Login - More Prominent */}
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

                        {/* Secondary Local Login - only shown when local auth is not disabled */}
                        {!disableLocalAuth && (
                            <Box sx={{ textAlign: 'center', pt: 2 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Don't have SSO access?
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
