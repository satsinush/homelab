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
    Avatar,
    Divider,
    Link
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Person as PersonIcon,
    Security as SecurityIcon,
    Router as RouterIcon,
    Computer as ComputerIcon,
    Storage as StorageIcon,
    Speed as SpeedIcon,
    OpenInNew as ExternalLinkIcon,
    Games as GamesIcon,
    Chat as ChatIcon,
    People as PeopleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import NetdataLogo from '../assets/netdata_logo.png';
import PiHoleLogo from '../assets/pi_hole_logo.png';
import PortainerLogo from '../assets/portainer_logo.jpg';
import VaultwardenLogo from '../assets/vaultwarden_logo.png';
import UptimeKumaLogo from '../assets/uptime_kuma_logo.png';
import AuthIcon from '../assets/auth_icon.png';
import DockgeLogo from '../assets/dockge_logo.png';
import DockhandLogo from '../assets/dockhand_logo.png';
import UsersIcon from '../assets/users_icon.png';

const Home = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { config } = useConfig();
    const hostnames = config.hostnames || {};
    const isAdmin = user?.groups?.includes('admin');

    const quickLinks = [
        {
            title: 'System',
            description: 'View real-time system resources, uptime, and performance metrics',
            icon: <DashboardIcon />,
            path: '/system',
            color: 'primary',
            adminOnly: true
        },
        {
            title: 'Devices',
            description: 'Manage Wake-on-LAN devices and network equipment',
            icon: <DevicesIcon />,
            path: '/devices',
            color: 'secondary'
        },
        {
            title: 'AI Chat',
            description: 'Ask questions and run actions with an AI chat bot',
            icon: <ChatIcon />,
            path: '/chat',
            color: 'info',
            adminOnly: true
        },
        {
            title: 'Word Games',
            description: 'Use solvers to word games like Letterboxed',
            icon: <GamesIcon />,
            path: '/wordgames',
            color: 'warning',
            adminOnly: true
        },
        {
            title: 'Packages',
            description: 'Install, update, and manage system packages',
            icon: <PackagesIcon />,
            path: '/packages',
            color: 'success',
            adminOnly: true
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
            adminOnly: true
        }
    ].filter(link => !link.adminOnly || isAdmin);

    const externalServices = [
        {
            title: 'Pi-hole Admin',
            description: 'Network-wide ad blocking and DNS management',
            url: `https://${hostnames.pihole || ''}/admin`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={PiHoleLogo}
                    alt="Pi-hole"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Netdata',
            description: 'Real-time performance monitoring and visualization',
            url: `https://${hostnames.netdata || ''}/v3`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={NetdataLogo}
                    alt="Netdata"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Portainer',
            description: 'Docker container management and monitoring',
            url: `https://${hostnames.portainer || ''}`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={PortainerLogo}
                    alt="Portainer"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Dockge',
            description: 'Compose-first Docker stack management',
            url: `https://${hostnames.dockge || ''}`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={DockgeLogo}
                    alt="Dockge"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Dockhand',
            description: 'Modern Docker management and compose workflows',
            url: `https://${hostnames.dockhand || ''}`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={DockhandLogo}
                    alt="Dockhand"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Vaultwarden',
            description: 'Self-hosted password management solution',
            url: `https://${hostnames.vaultwarden || ''}`,
            icon: (
                <Avatar
                    src={VaultwardenLogo}
                    alt="Vaultwarden"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Uptime Kuma',
            description: 'Self-hosted status monitoring solution',
            url: `https://${hostnames['uptime-kuma'] || ''}`,
            adminOnly: true,
            icon: (
                <Avatar
                    src={UptimeKumaLogo}
                    alt="Uptime Kuma"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        },
        {
            title: 'Authentik',
            description: 'Self-hosted authentication and identity provider',
            url: `https://${hostnames.authentik || ''}`,
            icon: (
                <Avatar
                    src={AuthIcon}
                    alt="Authentik"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        }
    ].filter(service => !service.adminOnly || isAdmin);

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            {/* Welcome Section */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h3" component="h1" gutterBottom>
                    Welcome to Homelab Dashboard
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Comprehensive monitoring and management for your home server
                </Typography>
                {user && (
                    <Chip
                        avatar={<Avatar><PersonIcon /></Avatar>}
                        label={`Welcome back, ${user.username}`}
                        color="primary"
                        variant="outlined"
                    />
                )}
            </Box>

            {/* Quick Links Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h2" gutterBottom>
                    Quick Links
                </Typography>
                <Grid container spacing={3}>
                    {quickLinks.map((link) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={link.path}>
                            <Card
                                onClick={() => navigate(link.path)}
                                sx={{
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(link.path);
                                        }}
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
                                onClick={() => window.location.href = service.url}
                                sx={{
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
                                                bgcolor: `transparent`,
                                                boxShadow: 5,
                                                mr: 2
                                            }}
                                        >
                                            {service.icon}
                                        </Avatar>
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
                                        color={service.color}
                                        href={service.url}
                                        onClick={(e) => e.stopPropagation()}
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
