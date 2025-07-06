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
    Divider
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Devices as DevicesIcon,
    Memory as ResourcesIcon,
    Inventory as PackagesIcon,
    Settings as SettingsIcon,
    Home as HomeIcon
} from '@mui/icons-material';
import './Navigation.css';

const Navigation = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
        { id: 'devices', label: 'Devices', icon: <DevicesIcon /> },
        { id: 'resources', label: 'Resources', icon: <ResourcesIcon /> },
        { id: 'packages', label: 'Packages', icon: <PackagesIcon /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
    ];

    const drawerWidth = 280;

    return (
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
                                onClick={() => setActiveTab(tab.id)}
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
        </Drawer>
    );
};

export default Navigation;
