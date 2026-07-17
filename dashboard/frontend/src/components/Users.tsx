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
    Tabs,
    Tab,
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
    Check as CheckIcon
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
    is_sso_user: boolean;
}

interface FileAccountItem {
    username: string;
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
                                person&apos;s Authentik login, but the password is separate from SSO.
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

interface FileAccountCardProps {
    acct: FileAccountItem;
    davHost: string;
    homelabHost: string;
    onResetPassword: () => void;
    onDelete: () => void;
}

const FileAccountCard = ({ acct, davHost, homelabHost, onResetPassword, onDelete }: FileAccountCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const [osTab, setOsTab] = useState(0);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    const smbPrivateWin = `\\\\${homelabHost}\\${acct.username}`;
    const smbSharedWin = `\\\\${homelabHost}\\shared`;
    const smbPrivateMac = `smb://${homelabHost}/${acct.username}`;
    const smbSharedMac = `smb://${homelabHost}/shared`;
    const webdavPrivate = `https://${davHost}/`;
    const webdavShared = `https://${davHost}/shared`;

    return (
        <Card variant="outlined" sx={{ mb: 2, overflow: 'hidden', borderColor: 'divider' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, bgcolor: 'background.paper' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                    <Avatar sx={{ bgcolor: 'info.main' }}>
                        <FolderIcon />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {acct.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Samba shares & WebDAV access
                        </Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setExpanded(!expanded)}
                        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                        {expanded ? 'Hide Info' : 'Connection Info'}
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<KeyIcon />}
                        onClick={onResetPassword}
                    >
                        Password
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={onDelete}
                    >
                        Delete
                    </Button>
                </Stack>
            </Box>

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Divider />
                <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'action.hover' }}>
                    <Tabs
                        value={osTab}
                        onChange={(_e, v) => setOsTab(v)}
                        variant="fullWidth"
                        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                    >
                        <Tab label="Windows" />
                        <Tab label="macOS" />
                        <Tab label="Linux & Mobile" />
                    </Tabs>

                    {osTab === 0 && (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Option A: WebDAV (Recommended for Windows)
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    WebDAV is reliable across all local and VPN network environments, and works natively in Windows Explorer.
                                    Right-click <strong>This PC</strong> in File Explorer, select <strong>Add a network location</strong>, and enter the URL:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Private WebDAV URL</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavPrivate}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'win_dav_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavPrivate, 'win_dav_priv')}>
                                        {copyFeedback === 'win_dav_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Shared WebDAV URL</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavShared}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'win_dav_shared' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavShared, 'win_dav_shared')}>
                                        {copyFeedback === 'win_dav_shared' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Option B: Samba (SMB) Shares
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Open File Explorer, click <strong>Map network drive</strong>, choose a drive letter, and enter:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Private Share (Home)</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbPrivateWin}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'win_smb_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbPrivateWin, 'win_smb_priv')}>
                                        {copyFeedback === 'win_smb_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Shared Folder</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbSharedWin}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'win_smb_shared' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbSharedWin, 'win_smb_shared')}>
                                        {copyFeedback === 'win_smb_shared' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                            </Box>

                            <Alert severity="info">
                                <AlertTitle>Samba & Docker Ports Note</AlertTitle>
                                On developer environments running Docker Desktop (e.g. WSL/macOS hosts), Samba is published on port <strong>4445</strong> because Windows natively reserves port 445. Windows Explorer does not support custom ports for SMB; please use <strong>WebDAV (Option A)</strong> if you are accessing from the host developer OS.
                            </Alert>
                        </Stack>
                    )}

                    {osTab === 1 && (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Connect via Finder
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    In Finder, press <strong>Cmd + K</strong> (or Go → Connect to Server) and enter one of these paths:
                                </Typography>
                                
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Private Share (Samba)</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbPrivateMac}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'mac_smb_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbPrivateMac, 'mac_smb_priv')}>
                                        {copyFeedback === 'mac_smb_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Shared Folder (Samba)</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbSharedMac}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'mac_smb_shared' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbSharedMac, 'mac_smb_shared')}>
                                        {copyFeedback === 'mac_smb_shared' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Private WebDAV URL</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavPrivate}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'mac_dav_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavPrivate, 'mac_dav_priv')}>
                                        {copyFeedback === 'mac_dav_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Shared WebDAV URL</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{webdavShared}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'mac_dav_shared' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(webdavShared, 'mac_dav_shared')}>
                                        {copyFeedback === 'mac_dav_shared' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                            </Box>
                        </Stack>
                    )}

                    {osTab === 2 && (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Linux / GNOME Files
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    In Files, select <strong>+ Other Locations</strong> and enter under "Connect to Server":
                                </Typography>
                                
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Samba (SMB) URI</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{smbPrivateMac}</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'lin_smb_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(smbPrivateMac, 'lin_smb_priv')}>
                                        {copyFeedback === 'lin_smb_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">WebDAV (HTTPS) URI</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>davs://{davHost}/</Typography>
                                    </Box>
                                    <Button size="small" startIcon={copyFeedback === 'lin_dav_priv' ? <CheckIcon color="success" /> : <CopyIcon />} onClick={() => handleCopy(`davs://${davHost}/`, 'lin_dav_priv')}>
                                        {copyFeedback === 'lin_dav_priv' ? 'Copied' : 'Copy'}
                                    </Button>
                                </Box>
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    iOS / Android Files Apps
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Use the built-in iOS Files app (Select <strong>...</strong> → <strong>Connect to Server</strong>) or Android third-party file managers (like Solid Explorer) to connect:
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 2, mb: 0.5 }}>
                                    • <strong>Protocol:</strong> SMB / Samba or WebDAV
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 2, mb: 0.5 }}>
                                    • <strong>Server Hostname:</strong> {homelabHost} (for SMB) or {davHost} (for WebDAV)
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                    • <strong>Username:</strong> {acct.username}
                                </Typography>
                            </Box>
                        </Stack>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};

const Users = () => {
    const [tabValue, setTabValue] = useState(0);
    const [usersList, setUsersList] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [fileAccounts, setFileAccounts] = useState<FileAccountItem[]>([]);
    const [fileAccountsLoading, setFileAccountsLoading] = useState(true);
    const [fileLoaded, setFileLoaded] = useState(false);
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
            setFileLoaded(true);
        } catch (err) {
            showError(`Failed to load file-access accounts: ${getErrorMessage(err)}`);
        } finally {
            setFileAccountsLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (tabValue === 1 && !fileLoaded) {
            fetchFileAccounts();
        }
    }, [tabValue, fileLoaded, fetchFileAccounts]);

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

    return (
        <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
            <PageHeader title="Users" icon={<PeopleIcon />} />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={(_e, v: number) => setTabValue(v)}
                    aria-label="user management tabs"
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                >
                    <Tab
                        icon={<PeopleIcon />}
                        iconPosition="start"
                        label="Dashboard Users"
                        id="users-tab-0"
                        aria-controls="users-tabpanel-0"
                        sx={{
                            minWidth: { xs: 'auto', sm: 160 },
                            '& .MuiTab-iconWrapper': { display: { xs: 'none', sm: 'inline-flex' } }
                        }}
                    />
                    <Tab
                        icon={<FolderIcon />}
                        iconPosition="start"
                        label="SMB / WebDAV"
                        id="users-tab-1"
                        aria-controls="users-tabpanel-1"
                        sx={{
                            minWidth: { xs: 'auto', sm: 160 },
                            '& .MuiTab-iconWrapper': { display: { xs: 'none', sm: 'inline-flex' } }
                        }}
                    />
                </Tabs>
            </Box>

            {tabValue === 0 && (
                <Box role="tabpanel" id="users-tabpanel-0" aria-labelledby="users-tab-0">
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '280px' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
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
                                                alignItems="flex-start"
                                                sx={{
                                                    flexDirection: { xs: 'column', sm: 'row' },
                                                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                                                    gap: { xs: 1.5, sm: 0 },
                                                    py: 1.5
                                                }}
                                                secondaryAction={
                                                    u.id !== currentUser?.id ? (
                                                        <Box
                                                            sx={{
                                                                position: { xs: 'static', sm: 'absolute' },
                                                                right: { sm: 16 },
                                                                top: { sm: '50%' },
                                                                transform: { sm: 'translateY(-50%)' },
                                                                alignSelf: { xs: 'stretch', sm: 'auto' },
                                                                mt: { xs: 0.5, sm: 0 }
                                                            }}
                                                        >
                                                            <Button
                                                                variant="outlined"
                                                                color="error"
                                                                size="small"
                                                                fullWidth
                                                                onClick={() => handleDeleteUser(u)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </Box>
                                                    ) : undefined
                                                }
                                            >
                                                <ListItemAvatar>
                                                    <Avatar sx={{ bgcolor: u.roles?.includes('homelab-admin') ? 'warning.main' : 'primary.main' }}>
                                                        {u.username?.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    sx={{ pr: { sm: u.id !== currentUser?.id ? 12 : 0 } }}
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
                                                                <Typography variant="body2" color="text.secondary" component="span" sx={{ overflowWrap: 'anywhere' }}>
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
                    )}
                </Box>
            )}

            {tabValue === 1 && (
                <Box role="tabpanel" id="users-tabpanel-1" aria-labelledby="users-tab-1">
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                                <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
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
                                    sx={{ width: { xs: '100%', sm: 'auto' } }}
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
                                <Box sx={{ mt: 2 }}>
                                    {fileAccounts.map((acct) => (
                                        <FileAccountCard
                                            key={acct.username}
                                            acct={acct}
                                            davHost={davHost}
                                            homelabHost={homelabHost}
                                            onResetPassword={() => setFileDialog({ open: true, mode: 'password', username: acct.username })}
                                            onDelete={() => handleDeleteFileAccount(acct.username)}
                                        />
                                    ))}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            )}

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
