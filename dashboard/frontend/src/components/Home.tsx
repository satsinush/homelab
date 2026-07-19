// src/components/Home.jsx
import React from 'react';
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
    Avatar
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
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from './PageHeader';
import { useAuth } from '../contexts/useAuth';
import { useConfig } from '../contexts/useConfig';
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
    const { user, hasPermission } = useAuth();
    const { config } = useConfig();
    const hostnames = config.hostnames || {};

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
        </Container>
    );
};

export default Home;
