import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Stack,
    Container,
    Alert,
    TextField,
    InputAdornment,
    IconButton,
    CircularProgress
} from '@mui/material';
import {
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/useAuth';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { getErrorMessage } from '../utils/errors';

const SetupLocalPassword = () => {
    const { user, refreshUser, logout } = useAuth();
    const { showSuccess, showError } = useNotification();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const passwordMismatch = confirm.length > 0 && password !== confirm;
    const canSave = !saving && password.length >= 12 && password === confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        setError('');
        try {
            if (!user) return;
            await tryApiCall('/users/profile', {
                method: 'PUT',
                data: {
                    username: user.username,
                    newPassword: password
                }
            });
            showSuccess('Local sync password configured successfully');
            await refreshUser();
        } catch (err) {
            const msg = getErrorMessage(err);
            setError(msg);
            showError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        await logout();
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
                        maxWidth: 420,
                        borderRadius: 2
                    }}
                >
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Box component="img" src="/homelab-icon.svg" alt="Homelab" sx={{ width: 64, height: 64, mb: 2 }} />
                        <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                            Configure Local Sync Password
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            You've signed in using SSO, but you still need a local password to connect your devices to file storage (Samba, WebDAV) and calendar/contacts (CalDAV/CardDAV).
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth
                                label="Sync Password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={saving}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon color="action" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={saving}>
                                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                helperText="Must be at least 12 characters"
                            />

                            <TextField
                                fullWidth
                                label="Confirm Sync Password"
                                type={showConfirm ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                disabled={saving}
                                error={passwordMismatch}
                                helperText={passwordMismatch ? 'Passwords do not match' : ''}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon color="action" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" disabled={saving}>
                                                    {showConfirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={!canSave}
                                startIcon={saving ? <CircularProgress size={20} /> : null}
                                sx={{ py: 1.5 }}
                            >
                                {saving ? 'Initializing account...' : 'Set Sync Password'}
                            </Button>

                            <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                fullWidth
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                Sign Out
                            </Button>
                        </Stack>
                    </form>
                </Paper>
            </Box>
        </Container>
    );
};

export default SetupLocalPassword;
