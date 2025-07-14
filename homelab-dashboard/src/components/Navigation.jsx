// src/components/Navigation.jsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
    IconButton,
    AppBar,
    Toolbar,
    useMediaQuery,
    useTheme,
    Avatar,
    Button,
    Menu,
    MenuItem
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Home as HomeIcon,
    Menu as MenuIcon,
    Person as PersonIcon,
    ExitToApp as LogoutIcon,
    AccountCircle as AccountIcon,
    Chat as ChatIcon
} from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const Navigation = ({ activeTab, mobileOpen, setMobileOpen }) => {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const { user, logout } = useAuth();
    const { showSuccess } = useNotification();
    const navigate = useNavigate();

    const tabs = [
        { id: 'home', label: 'Home', icon: <HomeIcon />, path: '/home' },
        { id: 'system', label: 'System', icon: <DashboardIcon />, path: '/system' },
        { id: 'devices', label: 'Devices', icon: <DevicesIcon />, path: '/devices' },
        { id: 'chat', label: 'AI Chat', icon: <ChatIcon />, path: '/chat' },
        { id: 'packages', label: 'Packages', icon: <PackagesIcon />, path: '/packages' },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/settings' }
    ];

    const drawerWidth = 280;
    const theme = useTheme();
    const { actualMode } = useThemeMode();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleProfileClick = () => {
        handleMenuClose();
        navigate('/profile');
    };

    const handleLogout = async () => {
        handleMenuClose();
        try {
            await logout();
            showSuccess('Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const drawerContent = (
        <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: actualMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                }
            }}>
                <Box
                    component={Link}
                    to="/home"
                    sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                    onClick={() => {
                        if (isMobile) {
                            setMobileOpen(false);
                        }
                    }}
                >
                    <HomeIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h5" component="h2" sx={{
                        fontWeight: 600,
                        color: 'text.primary'
                    }}>
                        Homelab Admin
                    </Typography>
                </Box>
            </Box>

            <Divider />

            {/* Navigation List */}
            <Box sx={{ flexGrow: 1 }}>
                <List sx={{ px: 1, py: 2 }}>
                    {tabs.map((tab) => (
                        <ListItem key={tab.id} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                component={Link}
                                to={tab.path}
                                selected={activeTab === tab.id}
                                onClick={() => {
                                    if (isMobile) {
                                        setMobileOpen(false); // Close drawer on mobile when tab is selected
                                    }
                                }}
                                sx={{
                                    borderRadius: '8px',
                                    mx: 1,
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    '&.Mui-selected': {
                                        backgroundColor: 'primary.main',
                                        color: 'primary.contrastText',
                                        '&:hover': {
                                            backgroundColor: 'primary.dark',
                                        },
                                        '& .MuiListItemIcon-root': {
                                            color: 'primary.contrastText',
                                        },
                                    },
                                    '&:hover': {
                                        backgroundColor: actualMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    {tab.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={tab.label}
                                    primaryTypographyProps={{
                                        fontWeight: activeTab === tab.id ? 600 : 500
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Box>

            {/* User Section */}
            <Box sx={{ p: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: actualMode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        cursor: 'pointer'
                    }}
                    onClick={handleMenuClick}
                >
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'primary.main',
                            mr: 1.5,
                            fontSize: '0.875rem'
                        }}
                    >
                        {user?.username?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {user?.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {user?.roles?.includes('admin') ? 'Administrator' : 'User'}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );

    return (
        <>
            {/* User Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: { width: 200, mt: 1 }
                }}
            >
                <MenuItem onClick={handleProfileClick}>
                    <ListItemIcon>
                        <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Profile</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                </MenuItem>
            </Menu>

            {/* Mobile App Bar */}
            {isMobile && (
                <AppBar
                    position="fixed"
                    sx={{
                        width: '100%',
                        backgroundColor: 'primary.main',
                        zIndex: (theme) => theme.zIndex.drawer + 1,
                    }}
                >
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <HomeIcon sx={{ mr: 1 }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                            Homelab Admin
                        </Typography>
                        <IconButton
                            color="inherit"
                            onClick={handleMenuClick}
                        >
                            <Avatar
                                sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: 'primary.light',
                                    fontSize: '0.875rem'
                                }}
                            >
                                {user?.username?.charAt(0).toUpperCase()}
                            </Avatar>
                        </IconButton>
                    </Toolbar>
                </AppBar>
            )}

            {/* Desktop Drawer */}
            {!isMobile && (
                <Drawer
                    variant="permanent"
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            backgroundColor: 'background.paper',
                            borderRight: `1px solid ${actualMode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            )}

            {/* Mobile Drawer */}
            {isMobile && (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile.
                    }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            backgroundColor: 'background.paper',
                            borderRight: `1px solid ${actualMode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            )}
        </>
    );
};

export default Navigation;
