// src/components/Profile.jsx
import React, { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Box,
    Alert,
    CircularProgress,
    Divider,
    InputAdornment,
    IconButton,
    Stack,
    Card,
    CardContent,
    CardHeader,
    Avatar
} from '@mui/material';
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Save as SaveIcon,
    AccountCircle as AccountCircleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { tryApiCall } from '../utils/api';

const Profile = () => {
    const { user, refreshUser } = useAuth();
    const { showError, showSuccess } = useNotification();

    const [username, setUsername] = useState(user?.username || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Validation
        if (!username || username.trim().length < 3) {
            setError('Username must be at least 3 characters long');
            setLoading(false);
            return;
        }

        if (newPassword && newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
            setLoading(false);
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            setError('New passwords do not match');
            setLoading(false);
            return;
        }

        if (newPassword && !currentPassword) {
            setError('Current password is required to change password');
            setLoading(false);
            return;
        }

        try {
            const result = await tryApiCall('/auth/profile', {
                method: 'PUT',
                data: {
                    username: username.trim(),
                    currentPassword: currentPassword || undefined,
                    newPassword: newPassword || undefined
                }
            });

            const message = newPassword ?
                'Profile and password updated successfully' :
                'Profile updated successfully'; setSuccess(message);
            showSuccess(message);

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Refresh user info to get updated username
            await refreshUser();

        } catch (error) {
            console.error('Profile update failed:', error);
            const errorMessage = error.response?.data?.error || 'Profile update failed';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePassword = (field) => {
        switch (field) {
            case 'current':
                setShowCurrentPassword(!showCurrentPassword);
                break;
            case 'new':
                setShowNewPassword(!showNewPassword);
                break;
            case 'confirm':
                setShowConfirmPassword(!showConfirmPassword);
                break;
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper elevation={1} sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 56, height: 56 }}>
                        <AccountCircleIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Profile Settings
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Update your account information and password
                        </Typography>
                    </Box>
                </Box>

                <form onSubmit={handleUpdateProfile}>
                    <Stack spacing={4}>
                        {/* User Information Card */}
                        <Card variant="outlined">
                            <CardHeader
                                avatar={<PersonIcon color="primary" />}
                                title="User Information"
                                subheader="Update your basic account details"
                            />
                            <CardContent>
                                <Stack spacing={3}>
                                    {error && (
                                        <Alert severity="error">
                                            {error}
                                        </Alert>
                                    )}

                                    {success && (
                                        <Alert severity="success">
                                            {success}
                                        </Alert>
                                    )}

                                    <TextField
                                        fullWidth
                                        label="Username"
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
                                        helperText="Username must be at least 3 characters long"
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

                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Current Role: {user?.roles?.join(', ') || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Password Change Card */}
                        <Card variant="outlined">
                            <CardHeader
                                avatar={<LockIcon color="primary" />}
                                title="Change Password"
                                subheader="Leave blank if you don't want to change your password"
                            />
                            <CardContent>
                                <Stack spacing={3}>
                                    <TextField
                                        fullWidth
                                        label="Current Password"
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
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
                                                            onClick={() => handleTogglePassword('current')}
                                                            edge="end"
                                                            disabled={loading}
                                                        >
                                                            {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        helperText="Required only if changing password"
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
                                        label="New Password"
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
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
                                                            onClick={() => handleTogglePassword('new')}
                                                            edge="end"
                                                            disabled={loading}
                                                        >
                                                            {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        helperText="Password must be at least 6 characters long"
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
                                        label="Confirm New Password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                                                            onClick={() => handleTogglePassword('confirm')}
                                                            edge="end"
                                                            disabled={loading}
                                                        >
                                                            {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        helperText="Must match new password"
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
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Submit Button */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                                sx={{ minWidth: 150 }}
                            >
                                {loading ? 'Updating...' : 'Update Profile'}
                            </Button>
                        </Box>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
};

export default Profile;
