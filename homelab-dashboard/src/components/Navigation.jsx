// src/components/Navigation.jsx
import React from 'react';
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
    useTheme
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Home as HomeIcon,
    Menu as MenuIcon
} from '@mui/icons-material';
import './Navigation.css';

const Navigation = ({ activeTab, setActiveTab, mobileOpen, setMobileOpen }) => {
    const tabs = [
        { id: 'system', label: 'System', icon: <DashboardIcon /> },
        { id: 'devices', label: 'Devices', icon: <DevicesIcon /> },
        { id: 'packages', label: 'Packages', icon: <PackagesIcon /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
    ];

    const drawerWidth = 280;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
        if (isMobile) {
            setMobileOpen(false); // Close drawer on mobile when tab is selected
        }
    };

    const drawerContent = (
        <Box sx={{ overflow: 'auto' }}>
            {/* Header */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HomeIcon sx={{ fontSize: 32, color: '#3b82f6' }} />
                <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Homelab Admin
                </Typography>
            </Box>

            <Divider />

            {/* Navigation List */}
            <List sx={{ px: 1, py: 2 }}>
                {tabs.map((tab) => (
                    <ListItem key={tab.id} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                            selected={activeTab === tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            sx={{
                                borderRadius: '8px',
                                mx: 1,
                                '&.Mui-selected': {
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: '#2563eb',
                                    },
                                    '& .MuiListItemIcon-root': {
                                        color: 'white',
                                    },
                                },
                                '&:hover': {
                                    backgroundColor: '#e2e8f0',
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
    );

    return (
        <>
            {/* Mobile App Bar */}
            {isMobile && (
                <AppBar
                    position="fixed"
                    sx={{
                        width: '100%',
                        backgroundColor: '#3b82f6',
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
                        <Typography variant="h6" noWrap component="div">
                            Homelab Admin
                        </Typography>
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
                            backgroundColor: '#f8fafc',
                            borderRight: '1px solid #e2e8f0'
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
                            backgroundColor: '#f8fafc',
                            borderRight: '1px solid #e2e8f0'
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
