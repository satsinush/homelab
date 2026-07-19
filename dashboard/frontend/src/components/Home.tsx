// src/components/Home.jsx
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Grid,
    Container,
    Chip,
    Avatar,
    Alert,
    AlertTitle,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    InputAdornment,
    IconButton,
    Stack,
    CircularProgress
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Person as PersonIcon,
    Extension as ExtensionIcon,
    Chat as ChatIcon,
    People as PeopleIcon,
    Home as HomeIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Key as KeyIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from './PageHeader';
import { useAuth } from '../contexts/useAuth';
import { useConfig } from '../contexts/useConfig';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { getErrorMessage } from '../utils/errors';
import PiHoleLogo from '../assets/pi_hole_logo.png';
import VaultwardenLogo from '../assets/vaultwarden_logo.png';
import GatusLogo from '../assets/gatus_logo.png';
import GotifyLogo from '../assets/gotify_logo.png';
import AuthIcon from '../assets/authentik_logo.png';
import DockhandLogo from '../assets/dockhand_logo.png';
import RadicaleLogo from '../assets/radicale_logo.png';
import SFTPGoLogo from '../assets/sftpgo_logo.png';

interface QuickLink {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'inherit' | 'error';
    role?: string;
}

interface ExternalService {
    title: string;
    description: string;
    url: string;
    logo: string;
    logoAlt: string;
    role?: string;
}

const Home = () => {
    const { user, hasPermission, refreshUser } = useAuth();
    const { config } = useConfig();
    const { showSuccess, showError } = useNotification();
    const hostnames = config.hostnames || {};

    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const passwordMismatch = confirm.length > 0 && password !== confirm;
    const canSave = !saving && password.length >= 12 && password === confirm;

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        setFormError('');
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
            setPasswordDialogOpen(false);
            setPassword('');
            setConfirm('');
            await refreshUser();
        } catch (err) {
            const msg = getErrorMessage(err);
            setFormError(msg);
            showError(msg);
        } finally {
            setSaving(false);
        }
    };

    const quickLinks = [
        {
            title: 'System',
            description: 'View real-time system resources, uptime, and performance metrics',
            icon: <DashboardIcon />,
            path: '/system',
            color: 'primary',
            role: 'dashboard-system-user'
        },
        {
            title: 'Devices',
            description: 'Manage Wake-on-LAN devices and network equipment',
            icon: <DevicesIcon />,
            path: '/devices',
            color: 'secondary',
            role: 'dashboard-devices-user'
        },
        {
            title: 'AI Chat',
            description: 'Ask questions and run actions with an AI chat bot',
            icon: <ChatIcon />,
            path: '/chat',
            color: 'info',
            role: 'dashboard-chat-user'
        },
        {
            title: 'Puzzle++',
            description: 'Use solvers to word games like Letterboxed',
            icon: <ExtensionIcon />,
            path: '/wordgames',
            color: 'warning',
            role: 'dashboard-wordgames-user'
        },
        {
            title: 'Packages',
            description: 'Install, update, and manage system packages',
            icon: <PackagesIcon />,
            path: '/packages',
            color: 'success',
            role: 'dashboard-packages-user'
        },
        {
            title: 'Settings',
            description: 'Configure dashboard preferences and system settings',
            icon: <SettingsIcon />,
            path: '/settings',
            color: 'info'
        },
        {
            title: 'Users',
            description: 'Manage user accounts, groups, and dashboard permissions',
            icon: <PeopleIcon />,
            path: '/users',
            color: 'warning',
            role: 'dashboard-users-user'
        }
    ].filter(link => !link.role || hasPermission(link.role)) as QuickLink[];

    const externalServices: ExternalService[] = [
        {
            title: 'Pi-hole Admin',
            description: 'Network-wide ad blocking and DNS management',
            url: `https://${hostnames.pihole || ''}/admin`,
            role: 'pihole-user',
            logo: PiHoleLogo,
            logoAlt: 'Pi-hole'
        },
        {
            title: 'Dockhand',
            description: 'Modern Docker management and compose workflows',
            url: `https://${hostnames.dockhand || ''}`,
            role: 'dockhand-user',
            logo: DockhandLogo,
            logoAlt: 'Dockhand'
        },
        {
            title: 'Vaultwarden',
            description: 'Self-hosted password management solution',
            url: `https://${hostnames.vaultwarden || ''}`,
            role: 'vaultwarden-user',
            logo: VaultwardenLogo,
            logoAlt: 'Vaultwarden'
        },
        {
            title: 'Gatus',
            description: 'Self-hosted service health status monitoring',
            url: `https://${hostnames.gatus || ''}`,
            logo: GatusLogo,
            logoAlt: 'Gatus'
        },
        {
            title: 'Gotify',
            description: 'Self-hosted push notification server',
            url: `https://${hostnames.gotify || ''}`,
            logo: GotifyLogo,
            logoAlt: 'Gotify'
        },
        {
            title: 'Authentik',
            description: 'Self-hosted authentication and identity provider',
            url: `https://${hostnames.authentik || ''}`,
            logo: AuthIcon,
            logoAlt: 'Authentik'
        },
        {
            title: 'SFTPGo Web client',
            description: 'Self-hosted file manager and WebDAV storage server',
            url: `https://${hostnames.dav || ''}/files/web/client`,
            logo: SFTPGoLogo,
            logoAlt: 'SFTPGo'
        },
        {
            title: 'Radicale',
            description: 'Simple CalDAV and CardDAV calendar/contact server',
            url: `https://${hostnames.dav || ''}/calendar/.web`,
            logo: RadicaleLogo,
            logoAlt: 'Radicale'
        }
    ].filter(service => !service.role || hasPermission(service.role));

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <PageHeader
                title="Home"
                icon={<HomeIcon />}
                actions={user && (
                    <Chip
                        avatar={<Avatar><PersonIcon /></Avatar>}
                        label={`Welcome back, ${user.username}`}
                        color="primary"
                        variant="outlined"
                    />
                )}
            />

            {user && !user.has_local_password && (
                <Alert
                    severity="warning"
                    icon={<WarningIcon fontSize="inherit" />}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            variant="outlined"
                            startIcon={<KeyIcon />}
                            onClick={() => setPasswordDialogOpen(true)}
                        >
                            Configure Password
                        </Button>
                    }
                    sx={{ mb: 4, borderRadius: 2 }}
                >
                    <AlertTitle sx={{ fontWeight: 600 }}>Local Sync Password Required</AlertTitle>
                    You have signed in via SSO but haven't set up a local password. You must configure one to access file shares (Samba, WebDAV) and calendar/contacts (CalDAV/CardDAV).
                </Alert>
            )}

            {/* Quick Links Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h2" gutterBottom>
                    Quick Links
                </Typography>
                <Grid container spacing={3}>
                    {quickLinks.map((link) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={link.path}>
                            <Card
                                component={RouterLink}
                                to={link.path}
                                sx={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: `${link.color}.main`,
                                                mr: 2
                                            }}
                                        >
                                            {link.icon}
                                        </Avatar>
                                        <Typography variant="h6" component="h3">
                                            {link.title}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {link.description}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color={link.color}
                                        component="div"
                                        sx={{ ml: 'auto' }}
                                    >
                                        Open
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* External Services Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h2" gutterBottom>
                    External Services
                </Typography>
                <Grid container spacing={3}>
                    {externalServices.map((service, index) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                            <Card
                                component="a"
                                href={service.url}
                                sx={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                mr: 2,
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: 1,
                                                bgcolor: 'background.paper',
                                                boxShadow: 2,
                                                p: 0.5
                                            }}
                                        >
                                            <Box
                                                component="img"
                                                src={service.logo}
                                                alt={service.logoAlt}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                    display: 'block'
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="h6" component="h3">
                                            {service.title}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {service.description}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color="primary"
                                        component="div"
                                        sx={{ ml: 'auto' }}
                                    >
                                        Open
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            <Dialog
                open={passwordDialogOpen}
                onClose={() => {
                    if (!saving) {
                        setPasswordDialogOpen(false);
                        setPassword('');
                        setConfirm('');
                        setFormError('');
                    }
                }}
                maxWidth="xs"
                fullWidth
            >
                <form onSubmit={handleSavePassword}>
                    <DialogTitle sx={{ fontWeight: 600 }}>Configure Local Sync Password Dialog</DialogTitle>
                    <DialogContent>
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            {formError && <Alert severity="error">{formError}</Alert>}
                            <Typography variant="body2" color="text.secondary">
                                Please set a local sync password. This password allows you to access file sync services since SSO logins aren't supported by desktop and mobile network clients.
                            </Typography>
                            <TextField
                                label="New Sync Password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={saving}
                                fullWidth
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
                                label="Confirm Sync Password"
                                type={showConfirm ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                disabled={saving}
                                error={passwordMismatch}
                                helperText={passwordMismatch ? "Passwords do not match" : ""}
                                fullWidth
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
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button
                            onClick={() => {
                                setPasswordDialogOpen(false);
                                setPassword('');
                                setConfirm('');
                                setFormError('');
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={!canSave}
                            startIcon={saving ? <CircularProgress size={20} /> : null}
                        >
                            {saving ? 'Saving...' : 'Set Password'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Container>
    );
};

export default Home;
