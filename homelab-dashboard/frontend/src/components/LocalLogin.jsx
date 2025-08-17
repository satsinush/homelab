// src/components/LocalLogin.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    IconButton,
    InputAdornment,
    Alert,
    CircularProgress,
    Container,
    Stack
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    ArrowBack,
    AccountCircle as AccountIcon,
    Settings as SetupIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { tryApiCall } from '../utils/api';

const useFirstUserCheck = () => {
    const [isFirstUser, setIsFirstUser] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkFirstUser = async () => {
            try {
                const result = await tryApiCall('/auth/first-user-check', {
                    method: 'GET'
                });
                setIsFirstUser(result.data.isFirstUser);
            } catch (error) {
                console.error('Error checking first user status:', error);
                setIsFirstUser(false);
            } finally {
                setLoading(false);
            }
        };

        checkFirstUser();
    }, []);

    return { isFirstUser, loading };
};

const LocalLogin = ({ onBack }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { loginLocal } = useAuth();
    const { showError, showSuccess } = useNotification();
    const { isFirstUser, loading: checkingFirstUser } = useFirstUserCheck();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password');
            setLoading(false);
            return;
        }

        try {
            const result = await loginLocal(username, password);
            if (result.success) {
                if (isFirstUser) {
                    showSuccess('Welcome! Your admin account has been created successfully.');
                } else {
                    showSuccess('Login successful!');
                }
            } else {
                setError(result.error || 'Login failed');
                showError(result.error || 'Login failed');
            }
        } catch (error) {
            const errorMessage = error.message || 'An unexpected error occurred';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

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
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <IconButton onClick={onBack} sx={{ mr: 1 }}>
                            <ArrowBack />
                        </IconButton>
                        <Typography variant="h5" component="h1">
                            Local Login
                        </Typography>
                    </Box>

                    {!isFirstUser && (
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Prefer SSO?{' '}
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => window.location.href = '/api/users/sso-login'}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Use SSO instead
                                </Button>
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        {isFirstUser ? (
                            <>
                                <SetupIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom color="success.main">
                                    First Time Setup
                                </Typography>
                                <Typography variant="body1" color="text.secondary">
                                    Create your admin account
                                </Typography>
                            </>
                        ) : (
                            <>
                                <AccountIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                                <Typography variant="body1" color="text.secondary">
                                    Enter your local credentials
                                </Typography>
                            </>
                        )}
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {isFirstUser && !error && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Choose any username and password - this will become your admin account.
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth
                                label={isFirstUser ? "Choose Username" : "Username"}
                                variant="outlined"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading || checkingFirstUser}
                                autoComplete="username"
                                autoFocus
                                helperText={isFirstUser ? "This will be your admin username" : ""}
                            />

                            <TextField
                                fullWidth
                                label={isFirstUser ? "Choose Password" : "Password"}
                                type={showPassword ? 'text' : 'password'}
                                variant="outlined"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading || checkingFirstUser}
                                autoComplete={isFirstUser ? "new-password" : "current-password"}
                                helperText={isFirstUser ? "This will be your admin password" : ""}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                aria-label="toggle password visibility"
                                                onClick={handleTogglePasswordVisibility}
                                                edge="end"
                                                disabled={loading || checkingFirstUser}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                disabled={loading || checkingFirstUser || !username.trim() || !password.trim()}
                                sx={{ mt: 2, py: 1.5 }}
                            >
                                {loading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : checkingFirstUser ? (
                                    'Loading...'
                                ) : isFirstUser ? (
                                    'Create Admin Account'
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </Stack>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default LocalLogin;
