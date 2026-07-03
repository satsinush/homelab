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
    Chip
} from '@mui/material';
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Edit as EditIcon,
    AccountCircle as AccountCircleIcon,
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { tryApiCall } from '../utils/api';

const autofillSx = (theme: any) => ({
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
            const error = err as Error;
            const msg = error.message || 'Failed to update username';
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

        if (!currentPassword) {
            setError('Current password is required');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
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
                    currentPassword,
                    newPassword
                }
            });
            showSuccess('Password updated successfully');
            handleClose();
        } catch (err) {
            const error = err as Error;
            const msg = error.message || 'Failed to update password';
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
                <DialogTitle>Change Password</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {passwordField('Current Password', currentPassword, setCurrentPassword, showCurrent, setShowCurrent, 'Enter your current password')}
                        <Divider />
                        {passwordField('New Password', newPassword, setNewPassword, showNew, setShowNew, 'At least 6 characters')}
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
                        {loading ? 'Saving...' : 'Change Password'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

const Profile = () => {
    const { user, refreshUser, hasPermission } = useAuth();
    const isSSO = user?.is_sso_user;
    const isAdmin = user?.roles?.includes('homelab-admin');
    const [usernameModalOpen, setUsernameModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
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

                {/* Security Section - Only for local users */}
                {!isSSO && (
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Security</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">Password</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>••••••••</Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<LockIcon />}
                                    onClick={() => setPasswordModalOpen(true)}
                                >
                                    Change
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Paper>

            {/* Modals */}
            {!isSSO && (
                <>
                    <ChangeUsernameModal
                        open={usernameModalOpen}
                        onClose={() => setUsernameModalOpen(false)}
                        currentUsername={user?.username || ''}
                        onSuccess={refreshUser}
                    />
                    <ChangePasswordModal
                        open={passwordModalOpen}
                        onClose={() => setPasswordModalOpen(false)}
                    />
                </>
            )}
        </Container>
    );
};

export default Profile;
