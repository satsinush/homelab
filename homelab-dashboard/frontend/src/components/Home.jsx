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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NetdataLogo from '../assets/netdata_logo.png';
import PiHoleLogo from '../assets/pi_hole_logo.png';
import PortainerLogo from '../assets/portainer_logo.jpg';
import VaultwardenLogo from '../assets/vaultwarden_logo.png';
import UptimeKumaLogo from '../assets/uptime_kuma_logo.png';
import NtfyLogo from '../assets/ntfy_logo.png';
import AutheliaLogo from '../assets/authelia_logo.png';
import AuthIcon from '../assets/auth_icon.png';

const Home = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const quickLinks = [
        {
            title: 'System Monitor',
            description: 'View real-time system resources, uptime, and performance metrics',
            icon: <DashboardIcon />,
            path: '/system',
            color: 'primary'
        },
        {
            title: 'Device Management',
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
            color: 'info'
        },
        {
            title: 'Word Games',
            description: 'Use solvers to word games like Letterboxed',
            icon: <GamesIcon />,
            path: '/wordgames',
            color: 'warning'
        },
        {
            title: 'Package Manager',
            description: 'Install, update, and manage system packages',
            icon: <PackagesIcon />,
            path: '/packages',
            color: 'success'
        },
        {
            title: 'Settings',
            description: 'Configure dashboard preferences and system settings',
            icon: <SettingsIcon />,
            path: '/settings',
            color: 'info'
        }
    ];

    const externalServices = [
        {
            title: 'Pi-hole Admin',
            description: 'Network-wide ad blocking and DNS management',
            url: `https://${import.meta.env.VITE_PIHOLE_WEB_HOSTNAME}/admin`,
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
            url: `https://${import.meta.env.VITE_NETDATA_WEB_HOSTNAME}/v3`,
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
            url: `https://${import.meta.env.VITE_PORTAINER_WEB_HOSTNAME}`,
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
            title: 'Vaultwarden',
            description: 'Self-hosted password management solution',
            url: `https://${import.meta.env.VITE_VAULTWARDEN_WEB_HOSTNAME}`,
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
            url: `https://${import.meta.env.VITE_UPTIME_KUMA_WEB_HOSTNAME}`,
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
            title: 'Ntfy',
            description: 'Self-hosted push notification service',
            url: `https://${import.meta.env.VITE_NTFY_WEB_HOSTNAME}`,
            icon: (
                <Avatar
                    src={NtfyLogo}
                    alt="Ntfy"
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
            title: 'LLDAP',
            description: 'Self-hosted LDAP service',
            url: `https://${import.meta.env.VITE_LLDAP_WEB_HOSTNAME}`,
            icon: (
                <Avatar
                    src={AuthIcon}
                    alt="LLDAP"
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
            title: 'Authelia',
            description: 'Self-hosted authentication and authorization service',
            url: `https://${import.meta.env.VITE_AUTHELIA_WEB_HOSTNAME}`,
            icon: (
                <Avatar
                    src={AutheliaLogo}
                    alt="Authelia"
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'transparent',
                    }}
                />
            ),
            color: 'white'
        }
    ];

    const systemFeatures = [
        {
            icon: <ComputerIcon />,
            title: 'System Monitoring',
            description: 'Real-time CPU, memory, disk, and network monitoring'
        },
        {
            icon: <RouterIcon />,
            title: 'Wake-on-LAN',
            description: 'Remote device power management and network discovery'
        },
        {
            icon: <StorageIcon />,
            title: 'Package Management',
            description: 'System package installation and updates'
        },
        {
            icon: <SpeedIcon />,
            title: 'Performance Metrics',
            description: 'Historical data and performance analytics'
        }
    ];

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
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
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
                                        onClick={() => navigate(link.path)}
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
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
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
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        endIcon={<ExternalLinkIcon />}
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

            <Divider sx={{ my: 4 }} />

            {/* Features Overview Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h2" gutterBottom>
                    Dashboard Features
                </Typography>
                <Grid container spacing={3}>
                    {systemFeatures.map((feature, index) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={index}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                                <Avatar
                                    sx={{
                                        bgcolor: 'primary.main',
                                        mr: 2,
                                        mt: 0.5,
                                        width: 40,
                                        height: 40
                                    }}
                                >
                                    {feature.icon}
                                </Avatar>
                                <Box>
                                    <Typography variant="h6" component="h3" gutterBottom>
                                        {feature.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {feature.description}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Container>
    );
};

export default Home;
