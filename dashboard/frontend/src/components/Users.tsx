// src/components/Users.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Divider,
    Chip,
    Avatar,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
} from '@mui/material';
import {
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon,
    Folder as FolderIcon,
    Add as AddIcon,
    Key as KeyIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { useAuth } from '../contexts/useAuth';

import { getErrorMessage } from '../utils/errors';

interface UserListItem {
    id: number;
    username: string;
    email?: string;
    roles: string[];
    is_sso_user: boolean;
}

interface FileAccountItem {
    username: string;
    uid: string;
    gid: string;
}

// Creating/updating accounts recreates the samba + sftpgo containers, which can take a while.
const FILE_ACCOUNT_TIMEOUT_MS = 150000;

interface FileAccountDialogProps {
    open: boolean;
    mode: 'create' | 'password';
    username: string;
    onClose: () => void;
    onSaved: () => void;
}

const FileAccountDialog = ({ open, mode, username: initialUsername, onClose, onSaved }: FileAccountDialogProps) => {
    const [username, setUsername] = useState(initialUsername);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const { showSuccess, showError } = useNotification();

    useEffect(() => {
        if (open) {
            setUsername(initialUsername);
            setPassword('');
            setConfirm('');
        }
    }, [open, initialUsername]);

    const passwordMismatch = confirm.length > 0 && password !== confirm;
    const canSave =
        !saving &&
        password.length >= 8 &&
        password === confirm &&
        (mode === 'password' || username.trim().length > 0);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (mode === 'create') {
                await tryApiCall('/users/file-accounts', {
                    method: 'POST',
                    data: { username: username.trim(), password },
                    timeout: FILE_ACCOUNT_TIMEOUT_MS
                });
                showSuccess(`File-access account "${username.trim()}" created`);
            } else {
                await tryApiCall(`/users/file-accounts/${encodeURIComponent(username)}/password`, {
                    method: 'PUT',
                    data: { password },
                    timeout: FILE_ACCOUNT_TIMEOUT_MS
                });
                showSuccess(`Password updated for "${username}"`);
            }
            onSaved();
            onClose();
        } catch (err) {
            showError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {mode === 'create' ? 'Add File-Access Account' : `Reset Password — ${username}`}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {mode === 'create' && (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                Used for Samba (SMB) shares and WebDAV. The username should match the
                                person's Authentik login, but the password is separate from SSO.
                            </Typography>
                            <TextField
                                label="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                fullWidth
                                disabled={saving}
                                helperText="Letters, digits, dots, dashes, and underscores only"
                            />
                        </>
                    )}
                    <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        disabled={saving}
                        autoFocus={mode === 'password'}
                        helperText="Minimum 8 characters"
                    />
                    <TextField
                        label="Confirm Password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        fullWidth
                        disabled={saving}
                        error={passwordMismatch}
                        helperText={passwordMismatch ? 'Passwords do not match' : ' '}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!canSave}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {saving ? 'Applying…' : mode === 'create' ? 'Create' : 'Update Password'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const Users = () => {
    const [usersList, setUsersList] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [fileAccounts, setFileAccounts] = useState<FileAccountItem[]>([]);
    const [fileAccountsLoading, setFileAccountsLoading] = useState(true);
    const [fileDialog, setFileDialog] = useState<{ open: boolean; mode: 'create' | 'password'; username: string }>({
        open: false,
        mode: 'create',
        username: ''
    });
    const { showSuccess, showError, showConfirmDialog } = useNotification();
    const { user: currentUser } = useAuth();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const result = await tryApiCall<{ users: UserListItem[] }>('/users');
            setUsersList(result.data.users || []);
        } catch (err) {
            showError(`Failed to load users: ${getErrorMessage(err)}`);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const fetchFileAccounts = useCallback(async () => {
        setFileAccountsLoading(true);
        try {
            const result = await tryApiCall<{ accounts: FileAccountItem[] }>('/users/file-accounts');
            setFileAccounts(result.data.accounts || []);
        } catch (err) {
            showError(`Failed to load file-access accounts: ${getErrorMessage(err)}`);
        } finally {
            setFileAccountsLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchUsers();
        fetchFileAccounts();
    }, [fetchUsers, fetchFileAccounts]);

    const handleDeleteFileAccount = (username: string) => {
        showConfirmDialog({
            title: 'Delete File-Access Account',
            message: `Remove SMB/WebDAV access for "${username}"? Their files in storage/users/${username} are kept on disk.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    await tryApiCall(`/users/file-accounts/${encodeURIComponent(username)}`, {
                        method: 'DELETE',
                        timeout: FILE_ACCOUNT_TIMEOUT_MS
                    });
                    showSuccess(`File-access account "${username}" deleted`);
                    fetchFileAccounts();
                } catch (err) {
                    showError(`Failed to delete account: ${getErrorMessage(err)}`);
                }
            }
        });
    };

    const handleDeleteUser = (userToDelete: UserListItem) => {
        showConfirmDialog({
            title: `Delete User`,
            message: `Are you sure you want to permanently delete user "${userToDelete.username}"? This will remove all of their settings, devices, and chats.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    await tryApiCall(`/users/${userToDelete.id}`, {
                        method: 'DELETE'
                    });
                    showSuccess(`User "${userToDelete.username}" deleted successfully`);
                    fetchUsers();
                } catch (err) {
                    showError(`Failed to delete user: ${getErrorMessage(err)}`);
                }
            }
        });
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
                    Users
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Manage user accounts and permissions
                </Typography>
            </Box>

            <Card>
                <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {usersList.length} user{usersList.length !== 1 ? 's' : ''} registered
                    </Typography>
                    <List disablePadding>
                        {usersList.map((u, idx) => (
                            <React.Fragment key={u.id}>
                                {idx > 0 && <Divider component="li" />}
                                <ListItem
                                    secondaryAction={
                                        u.id !== currentUser?.id && (
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={() => handleDeleteUser(u)}
                                            >
                                                Delete
                                            </Button>
                                        )
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: u.roles?.includes('homelab-admin') ? 'warning.main' : 'primary.main' }}>
                                            {u.username?.charAt(0).toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                    {u.username}
                                                </Typography>
                                                {u.id === currentUser?.id && (
                                                    <Chip label="You" size="small" color="primary" variant="outlined" />
                                                )}
                                                {u.roles?.includes('homelab-admin') && (
                                                    <Chip icon={<AdminIcon />} label="Admin" size="small" color="warning" variant="outlined" />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                                {u.email && (
                                                    <Typography variant="body2" color="text.secondary" component="span">
                                                        {u.email}
                                                    </Typography>
                                                )}
                                                <Chip
                                                    icon={u.is_sso_user ? <SSOIcon /> : <LocalIcon />}
                                                    label={u.is_sso_user ? 'SSO' : 'Local'}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ height: 22 }}
                                                />
                                            </Stack>
                                        }
                                        slotProps={{ secondary: { component: 'div' } }}
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                File Access (SMB / WebDAV)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Local accounts for Samba shares and WebDAV — passwords are separate from SSO.
                                Changes restart the samba and sftpgo containers.
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setFileDialog({ open: true, mode: 'create', username: '' })}
                        >
                            Add Account
                        </Button>
                    </Box>

                    {fileAccountsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : fileAccounts.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                            No file-access accounts yet. Add one to enable SMB and WebDAV logins.
                        </Typography>
                    ) : (
                        <List disablePadding>
                            {fileAccounts.map((acct, idx) => (
                                <React.Fragment key={acct.username}>
                                    {idx > 0 && <Divider component="li" />}
                                    <ListItem
                                        secondaryAction={
                                            <Stack direction="row" spacing={1}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<KeyIcon />}
                                                    onClick={() => setFileDialog({ open: true, mode: 'password', username: acct.username })}
                                                >
                                                    Reset Password
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    size="small"
                                                    onClick={() => handleDeleteFileAccount(acct.username)}
                                                >
                                                    Delete
                                                </Button>
                                            </Stack>
                                        }
                                    >
                                        <ListItemAvatar>
                                            <Avatar sx={{ bgcolor: 'info.main' }}>
                                                <FolderIcon />
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                    {acct.username}
                                                </Typography>
                                            }
                                            secondary={`SMB: \\\\server\\${acct.username} + \\\\server\\shared · WebDAV: / and /shared`}
                                        />
                                    </ListItem>
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </CardContent>
            </Card>

            <FileAccountDialog
                open={fileDialog.open}
                mode={fileDialog.mode}
                username={fileDialog.username}
                onClose={() => setFileDialog((d) => ({ ...d, open: false }))}
                onSaved={fetchFileAccounts}
            />
        </Container>
    );
};

export default Users;
