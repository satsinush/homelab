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
    TextField,
    Collapse,
    Alert,
    AlertTitle
} from '@mui/material';
import {
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon,
    Folder as FolderIcon,
    Add as AddIcon,
    Key as KeyIcon,
    People as PeopleIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ContentCopy as CopyIcon,
    Check as CheckIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { useAuth } from '../contexts/useAuth';
import { useConfig } from '../contexts/useConfig';

import { getErrorMessage } from '../utils/errors';

interface UserListItem {
    id: number;
    username: string;
    email?: string;
    roles: string[];
    groups: string[];
    is_sso_user: boolean;
    has_local_password?: boolean;
}

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
                    body: JSON.stringify({ username, password }),
                    timeout: FILE_ACCOUNT_TIMEOUT_MS
                });
                showSuccess(`User "${username}" created with local password`);
            } else {
                await tryApiCall(`/users/file-accounts/${encodeURIComponent(username)}/password`, {
                    method: 'PUT',
                    body: JSON.stringify({ password }),
                    timeout: FILE_ACCOUNT_TIMEOUT_MS
                });
                showSuccess(`Local password updated for "${username}"`);
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
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 600 }}>
                {mode === 'create' ? 'Add Local User' : `Set Local Password for ${username}`}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                    {mode === 'create' && (
                        <TextField
                            label="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            fullWidth
                            size="small"
                            autoFocus
                        />
                    )}
                    <TextField
                        label="Local Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        size="small"
                        helperText="At least 8 characters. Used for SMB, WebDAV, and Calendar/Contacts sync."
                    />
                    <TextField
                        label="Confirm Password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        fullWidth
                        size="small"
                        error={passwordMismatch}
                        helperText={passwordMismatch ? 'Passwords do not match' : ''}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!canSave}
                >
                    {saving ? 'Syncing Stack...' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const Users = () => {
    const [usersList, setUsersList] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<number | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const [fileDialog, setFileDialog] = useState<{ open: boolean; mode: 'create' | 'password'; username: string }>({
        open: false,
        mode: 'create',
        username: ''
    });
    const { showSuccess, showError, showConfirmDialog } = useNotification();
    const { user: currentUser } = useAuth();
    const { config } = useConfig();

    const davHost = config.hostnames.dav || 'dav.homelab.local';
    const homelabHost = config.homelabHostname || window.location.hostname.replace('dashboard.', '') || 'homelab.local';
    const radicaleHost = `${davHost}/radicale`;

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

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    const handleDeleteUser = (u: UserListItem) => {
        showConfirmDialog({
            title: 'Delete User Account',
            message: `Are you sure you want to permanently delete user "${u.username}"? This will remove all of their settings, devices, chats, and revoke Samba/WebDAV/CalDAV credentials.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    await tryApiCall(`/users/file-accounts/${encodeURIComponent(u.username)}`, {
                        method: 'DELETE',
                        timeout: FILE_ACCOUNT_TIMEOUT_MS
                    });
                    showSuccess(`User "${u.username}" deleted successfully`);
                    fetchUsers();
                } catch (err) {
                    showError(`Failed to delete user: ${getErrorMessage(err)}`);
                }
            }
        });
    };

    // Find current user's entry in the loaded users list to check fresh local password status
    const currentUserProfile = usersList.find(u => u.id === currentUser?.id);

    return (
        <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
            <PageHeader title="User Accounts" icon={<PeopleIcon />} />

            {currentUserProfile && !currentUserProfile.has_local_password && (
                <Alert
                    severity="warning"
                    icon={<WarningIcon />}
                    sx={{
                        mb: 3,
                        border: '1px solid',
                        borderColor: 'warning.light',
                        '& .MuiAlert-message': { width: '100%' }
                    }}
                >
                    <AlertTitle sx={{ fontWeight: 600 }}>Local Sync Password Required</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                        You have signed in via SSO but haven't configured a local password.
                        You will need a local password to authenticate with background sync services like <strong>Samba (file sharing)</strong>, <strong>SFTPGo (WebDAV)</strong>, or <strong>Radicale (Calendar & Contacts)</strong>.
                    </Typography>
                    <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        startIcon={<KeyIcon />}
                        onClick={() => setFileDialog({ open: true, mode: 'password', username: currentUserProfile.username })}
                    >
                        Set Local Password
                    </Button>
                </Alert>
            )}

            <Card sx={{ mt: 2 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {usersList.length} user{usersList.length !== 1 ? 's' : ''} registered
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setFileDialog({ open: true, mode: 'create', username: '' })}
                        >
                            Add Local User
                        </Button>
                    </Box>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <List disablePadding>
                            {usersList.map((u, idx) => {
                                const smbPrivateWin = `\\\\${homelabHost}\\${u.username}`;
                                const smbSharedWin = `\\\\${homelabHost}\\shared`;
                                const smbPrivateMac = `smb://${homelabHost}/${u.username}`;
                                const smbSharedMac = `smb://${homelabHost}/shared`;
                                const webdavPrivate = `https://${davHost}/`;
                                const webdavShared = `https://${davHost}/shared`;
                                const radicaleUrl = `https://${radicaleHost}`;

                                const isUserAdmin = u.roles?.includes('homelab-admin') || u.groups?.includes('admin');
                                const isExpanded = expandedUser === u.id;

                                return (
                                    <React.Fragment key={u.id}>
                                        {idx > 0 && <Divider component="li" />}
                                        <ListItem
                                            alignItems="flex-start"
                                            sx={{
                                                flexDirection: 'column',
                                                alignItems: 'stretch',
                                                py: 2,
                                                px: { xs: 0.5, sm: 1.5 }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, width: '100%' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Avatar sx={{ bgcolor: isUserAdmin ? 'warning.main' : 'primary.main', width: 44, height: 44 }}>
                                                        {u.username?.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    <Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                                {u.username}
                                                            </Typography>
                                                            {u.id === currentUser?.id && (
                                                                <Chip label="You" size="small" color="primary" variant="outlined" sx={{ height: 20 }} />
                                                            )}
                                                            {isUserAdmin && (
                                                                <Chip icon={<AdminIcon style={{ fontSize: 13 }} />} label="Admin" size="small" color="warning" variant="outlined" sx={{ height: 20 }} />
                                                            )}
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                                                            {u.email || 'No email registered'}
                                                        </Typography>
                                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                                            {u.is_sso_user && (
                                                                <Chip icon={<SSOIcon style={{ fontSize: 14 }} />} label="SSO" size="small" variant="outlined" sx={{ height: 20 }} />
                                                            )}
                                                            {u.has_local_password ? (
                                                                <Chip icon={<LocalIcon style={{ fontSize: 14 }} />} label="Sync Active" size="small" color="success" variant="outlined" sx={{ height: 20 }} />
                                                            ) : (
                                                                <Chip icon={<WarningIcon style={{ fontSize: 14 }} />} label="No Sync Password" size="small" color="default" variant="outlined" sx={{ height: 20 }} />
                                                            )}
                                                        </Stack>
                                                    </Box>
                                                </Box>

                                                <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'stretch', sm: 'auto' }, justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
                                                    {u.has_local_password && (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                            onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                                        >
                                                            Instructions
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<KeyIcon />}
                                                        onClick={() => setFileDialog({ open: true, mode: 'password', username: u.username })}
                                                    >
                                                        {u.has_local_password ? 'Change Password' : 'Set Password'}
                                                    </Button>
                                                    {u.id !== currentUser?.id && (
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            size="small"
                                                            onClick={() => handleDeleteUser(u)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </Box>

                                            <Collapse in={isExpanded} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                                                <Box sx={{ mt: 2.5, p: { xs: 1.5, sm: 2.5 }, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                                    <Stack spacing={3.5}>
                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                                Samba (SMB) File Sharing Paths
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                                                Use these connection paths to map network drives on your computer.
                                                            </Typography>
                                                            <Stack spacing={1.5}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="caption" color="text.secondary" display="block">Private Home (Windows: {smbPrivateWin} | macOS: {smbPrivateMac})</Typography>
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbPrivateWin}</Typography>
                                                                    </Box>
                                                                    <Button size="small" startIcon={copyFeedback === `smb_priv_${u.id}` ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbPrivateWin, `smb_priv_${u.id}`)}>
                                                                        {copyFeedback === `smb_priv_${u.id}` ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="caption" color="text.secondary" display="block">Shared Folder (Windows: {smbSharedWin} | macOS: {smbSharedMac})</Typography>
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbSharedWin}</Typography>
                                                                    </Box>
                                                                    <Button size="small" startIcon={copyFeedback === `smb_shared_${u.id}` ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbSharedWin, `smb_shared_${u.id}`)}>
                                                                        {copyFeedback === `smb_shared_${u.id}` ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                </Box>
                                                            </Stack>
                                                        </Box>

                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                                WebDAV File Storage URLs
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                                                Recommended for mobile file integrations or plugins.
                                                            </Typography>
                                                            <Stack spacing={1.5}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="caption" color="text.secondary" display="block">Private Home Folder</Typography>
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavPrivate}</Typography>
                                                                    </Box>
                                                                    <Button size="small" startIcon={copyFeedback === `dav_priv_${u.id}` ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavPrivate, `dav_priv_${u.id}`)}>
                                                                        {copyFeedback === `dav_priv_${u.id}` ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="caption" color="text.secondary" display="block">Shared Folder</Typography>
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavShared}</Typography>
                                                                    </Box>
                                                                    <Button size="small" startIcon={copyFeedback === `dav_shared_${u.id}` ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavShared, `dav_shared_${u.id}`)}>
                                                                        {copyFeedback === `dav_shared_${u.id}` ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                </Box>
                                                            </Stack>
                                                        </Box>

                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                                Calendar & Contacts Sync (CalDAV / CardDAV)
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                                                Specify this URL in your phone or computer account settings to synchronize calendar and contacts.
                                                            </Typography>
                                                            <Stack spacing={1.5}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="caption" color="text.secondary" display="block">Server Address</Typography>
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{radicaleUrl}</Typography>
                                                                    </Box>
                                                                    <Button size="small" startIcon={copyFeedback === `rad_${u.id}` ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(radicaleUrl, `rad_${u.id}`)}>
                                                                        {copyFeedback === `rad_${u.id}` ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                </Box>
                                                            </Stack>
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Collapse>
                                        </ListItem>
                                    </React.Fragment>
                                );
                            })}
                        </List>
                    )}
                </CardContent>
            </Card>

            <FileAccountDialog
                open={fileDialog.open}
                mode={fileDialog.mode}
                username={fileDialog.username}
                onClose={() => setFileDialog((d) => ({ ...d, open: false }))}
                onSaved={fetchUsers}
            />
        </Container>
    );
};

export default Users;
