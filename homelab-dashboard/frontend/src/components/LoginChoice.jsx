// src/components/LoginChoice.jsx
import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Divider,
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

const LoginChoice = () => {
    const [showLocalLogin, setShowLocalLogin] = useState(false);

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
                        <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Welcome
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Choose your login method
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
                                    Recommended - Use your homelab account
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

                        {/* Secondary Local Login - Smaller */}
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
                    </Stack>
                </Paper>
            </Box>
        </Container>
    );
};

export default LoginChoice;
