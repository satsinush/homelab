// src/components/Login.jsx
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Container,
    Alert,
    CircularProgress,
    Stack,
    Avatar,
    InputAdornment,
    IconButton
} from '@mui/material';
import {
    Lock as LockIcon,
    Person as PersonIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Computer as ComputerIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const { showError, showSuccess } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password');
            setLoading(false);
            return;
        }

        try {
            const result = await login(username, password);

            if (result.success) {
                showSuccess(`Welcome back, ${result.user.username}!`);
            } else {
                setError(result.error);
                showError(result.error);
            }
        } catch (error) {
            const errorMessage = 'An unexpected error occurred. Please try again.';
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
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
            >
                <Card
                    sx={{
                        width: '100%',
                        maxWidth: 400,
                        boxShadow: 3,
                        borderRadius: 2
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                mb: 3
                            }}
                        >
                            <Avatar
                                sx={{
                                    m: 1,
                                    bgcolor: 'primary.main',
                                    width: 56,
                                    height: 56
                                }}
                            >
                                <ComputerIcon sx={{ fontSize: 32 }} />
                            </Avatar>
                            <Typography
                                component="h1"
                                variant="h4"
                                sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}
                            >
                                Homelab Dashboard
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                align="center"
                            >
                                Sign in to access your homelab controls
                            </Typography>
                        </Box>

                        <form onSubmit={handleSubmit}>
                            <Stack spacing={3}>
                                {error && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        {error}
                                    </Alert>
                                )}

                                <TextField
                                    fullWidth
                                    label="Username"
                                    name="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PersonIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    variant="outlined"
                                    sx={(theme) => ({
                                        '& input:-webkit-autofill': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                            backgroundColor: 'transparent !important',
                                            transition: 'background-color 5000s ease-in-out 0s',
                                        },
                                        '& input:-webkit-autofill:hover': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                        },
                                        '& input:-webkit-autofill:focus': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                        },
                                    })}
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockIcon color="action" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={handleTogglePasswordVisibility}
                                                        edge="end"
                                                        disabled={loading}
                                                    >
                                                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    variant="outlined"
                                    sx={(theme) => ({
                                        '& input:-webkit-autofill': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                            backgroundColor: 'transparent !important',
                                            transition: 'background-color 5000s ease-in-out 0s',
                                        },
                                        '& input:-webkit-autofill:hover': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                        },
                                        '& input:-webkit-autofill:focus': {
                                            WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                            WebkitTextFillColor: `${theme.palette.text.primary} !important`,
                                        },
                                    })}
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    sx={{
                                        mt: 3,
                                        mb: 2,
                                        py: 1.5,
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    {loading ? (
                                        <CircularProgress size={24} color="inherit" />
                                    ) : (
                                        'Sign In'
                                    )}
                                </Button>
                            </Stack>
                        </form>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
};

export default Login;
