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
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Theme
} from '@mui/material';
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Edit as EditIcon,
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { useAuth } from '../contexts/useAuth';
import { useNotification } from '../contexts/useNotification';
import { tryApiCall } from '../utils/api';

import { getErrorMessage } from '../utils/errors';

const autofillSx = (theme: Theme) => ({
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
});

interface ChangeUsernameModalProps {
    open: boolean;
    onClose: () => void;
    currentUsername: string;
    onSuccess: () => void;
}

// Change Username Modal
const ChangeUsernameModal = ({ open, onClose, currentUsername, onSuccess }: ChangeUsernameModalProps) => {
    const [newUsername, setNewUsername] = useState(currentUsername);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { showSuccess, showError } = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newUsername || newUsername.trim().length < 3) {
            setError('Username must be at least 3 characters long');
            return;
        }

        if (newUsername.trim() === currentUsername) {
            setError('New username is the same as current');
            return;
        }

        if (!password) {
            setError('Password is required to change username');
            return;
        }

        setLoading(true);
        try {
            await tryApiCall('/users/profile', {
                method: 'PUT',
                data: {
                    username: newUsername.trim(),
                    currentPassword: password
                }
            });
            showSuccess('Username updated successfully');
            onSuccess();
            handleClose();
        } catch (err) {
            const msg = getErrorMessage(err) || 'Failed to update username';
            setError(msg);
            showError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setNewUsername(currentUsername);
        setPassword('');
        setShowPassword(false);
        setError('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Change Username</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            autoFocus
                            fullWidth
                            label="New Username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
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
                            sx={autofillSx}
                        />
                        <TextField
                            fullWidth
                            label="Confirm Password"
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
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading}>
                                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            helperText="Enter your current password to confirm this change"
                            sx={autofillSx}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleClose} disabled={loading}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                        {loading ? 'Saving...' : 'Change Username'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

interface ChangePasswordModalProps {
    open: boolean;
    onClose: () => void;
}

// Change Password Modal
const ChangePasswordModal = ({ open, onClose }: ChangePasswordModalProps) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const { showSuccess, showError } = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const needsCurrentPassword = user?.has_local_password;
        if (needsCurrentPassword && !currentPassword) {
            setError('Current password is required');
            return;
        }

        if (!newPassword || newPassword.length < 12) {
            setError('New password must be at least 12 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            if (!user) return;
            await tryApiCall('/users/profile', {
                method: 'PUT',
                data: {
                    username: user.username,
                    currentPassword: needsCurrentPassword ? currentPassword : undefined,
                    newPassword
                }
            });
            showSuccess('Password updated successfully');
            handleClose();
        } catch (err) {
            const msg = getErrorMessage(err) || 'Failed to update password';
            setError(msg);
            showError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setError('');
        onClose();
    };

    const passwordField = (
        label: string,
        value: string,
        setValue: (val: string) => void,
        show: boolean,
        setShow: (show: boolean) => void,
        helperText: string
    ) => (
        <TextField
            fullWidth
            label={label}
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
                            <IconButton onClick={() => setShow(!show)} edge="end" disabled={loading}>
                                {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
            helperText={helperText}
            sx={autofillSx}
        />
    );

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>{user?.has_local_password ? 'Change Password' : 'Set Local Password'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {user?.has_local_password && passwordField('Current Password', currentPassword, setCurrentPassword, showCurrent, setShowCurrent, 'Enter your current password')}
                        {user?.has_local_password && <Divider />}
                        {passwordField('New Password', newPassword, setNewPassword, showNew, setShowNew, 'At least 12 characters')}
                        {passwordField('Confirm New Password', confirmPassword, setConfirmPassword, showConfirm, setShowConfirm, 'Must match new password')}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleClose} disabled={loading}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                    >
                        {loading ? 'Saving...' : user?.has_local_password ? 'Change Password' : 'Set Password'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

const Profile = () => {
    const { user, refreshUser } = useAuth();
    const isSSO = !!user?.sso_id;
    const isAdmin = user?.roles?.includes('homelab-admin');
    const [usernameModalOpen, setUsernameModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <PageHeader title="Profile" icon={<PersonIcon />} />
            <Paper elevation={1} sx={{ p: 4 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 64, height: 64, fontSize: '1.5rem' }}>
                        {user?.username?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="h4" component="h1">
                                {user?.username}
                            </Typography>
                            {isAdmin && (
                                <Chip icon={<AdminIcon />} label="Admin" size="small" color="warning" variant="outlined" />
                            )}
                            <Chip
                                icon={isSSO ? <SSOIcon /> : <LocalIcon />}
                                label={isSSO ? 'SSO Account' : 'Local Account'}
                                size="small"
                                variant="outlined"
                            />
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                            {user?.email || 'No email set'}
                        </Typography>
                    </Box>
                </Box>

                {/* SSO Notice */}
                {isSSO && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        Your account is managed through Authentik SSO. Username and password changes must be made through your SSO provider.
                    </Alert>
                )}

                {/* Account Details */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Account Details</Typography>
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">Username</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{user?.username}</Typography>
                                </Box>
                                {!isSSO && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<EditIcon />}
                                        onClick={() => setUsernameModalOpen(true)}
                                    >
                                        Change
                                    </Button>
                                )}
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">Email</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{user?.email || 'Not set'}</Typography>
                                </Box>
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">Groups</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {user?.groups?.join(', ') || 'None'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Security Section */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Security</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    {isSSO ? 'Local Sync Password' : 'Password'}
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>••••••••</Typography>
                                {isSSO && (
                                    <Typography variant="caption" color="text.secondary">
                                        Used for Samba (LAN file shares). Web files/calendar/contacts use Authentik SSO via Nextcloud.
                                    </Typography>
                                )}
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<LockIcon />}
                                onClick={() => setPasswordModalOpen(true)}
                            >
                                {user?.has_local_password ? 'Change' : 'Set'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Paper>

            {/* Modals */}
            {!isSSO && (
                <ChangeUsernameModal
                    open={usernameModalOpen}
                    onClose={() => setUsernameModalOpen(false)}
                    currentUsername={user?.username || ''}
                    onSuccess={refreshUser}
                />
            )}
            <ChangePasswordModal
                open={passwordModalOpen}
                onClose={() => {
                    setPasswordModalOpen(false);
                    refreshUser();
                }}
            />
        </Container>
    );
};

export default Profile;
