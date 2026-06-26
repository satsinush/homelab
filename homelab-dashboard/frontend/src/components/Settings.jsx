// src/components/Settings.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Alert,
    CircularProgress,
    Container,
    Button,
    TextField,
    Stack,
    List,
    ListItem,
    ListItemText,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    Chip,
    Grid,
    Tabs,
    Tab
} from '@mui/material';
import {
    NetworkWifi as NetworkIcon,
    Timer as TimerIcon,
    Save as SaveIcon,
    Computer as ComputerIcon,
    Palette as ThemeIcon,
    LightMode as LightIcon,
    DarkMode as DarkIcon,
    SettingsBrightness as DeviceIcon,
    Cloud as ServerIcon,
    Devices as DevicesIcon,
    Person as UserIcon,
    Security as SecurityIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

const UsersPanel = ({ currentUser }) => {
    const [usersList, setUsersList] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const { showSuccess, showError, showDeleteConfirmation } = useNotification();

    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const result = await tryApiCall('/users');
            setUsersList(result.data.users || []);
        } catch (err) {
            showError(`Failed to load users: ${err.message}`);
        } finally {
            setUsersLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDeleteUser = (userToDelete) => {
        showDeleteConfirmation({
            title: `Delete User`,
            message: `Are you sure you want to permanently delete user "${userToDelete.username}"? This will remove all of their settings and chats.`,
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
                    showError(`Failed to delete user: ${err.message}`);
                }
            }
        });
    };

    if (usersLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    return (
        <Card sx={{ mt: 2 }}>
            <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Users Management</Typography>
                <List>
                    {usersList.map((u) => (
                        <React.Fragment key={u.id}>
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
                                <ListItemText
                                    primary={u.username}
                                    primaryTypographyProps={{ fontWeight: 600 }}
                                    secondary={
                                        <>
                                            {u.email && `${u.email} • `}
                                            {u.is_sso_user ? 'SSO User' : 'Local User'} • Groups: {u.groups}
                                        </>
                                    }
                                />
                            </ListItem>
                            <Divider component="li" />
                        </React.Fragment>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
};

const Settings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const { themeMode, setThemeMode, actualMode } = useThemeMode();
    const { showSuccess, showError } = useNotification();
    const { user } = useAuth();
    const isAdmin = user?.groups?.includes('admin');

    const tabsList = useMemo(() => {
        const list = [];
        if (isAdmin) {
            list.push({ id: 'server', label: 'Server', icon: <ServerIcon /> });
        }
        list.push({ id: 'device', label: 'Device', icon: <DevicesIcon /> });
        if (isAdmin) {
            list.push({ id: 'users', label: 'Users', icon: <UserIcon /> });
        }
        return list;
    }, [isAdmin]);

    // Adjust tabValue if it gets out of bounds
    useEffect(() => {
        if (tabValue >= tabsList.length) {
            setTabValue(0);
        }
    }, [tabsList, tabValue]);

    const currentTabId = tabsList[tabValue]?.id || 'device';

    // Auto-save debounced function
    const debouncedSave = useCallback(
        debounce(async (settingsToSave) => {
            setAutoSaving(true);
            try {
                await tryApiCall('/settings', {
                    method: 'PUT',
                    data: settingsToSave
                });
                showSuccess('Settings saved automatically');
            } catch (err) {
                showError(`Failed to save settings: ${err.message}`);
            } finally {
                setAutoSaving(false);
            }
        }, 1000),
        [showSuccess, showError]
    );

    // Debounce utility function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const result = await tryApiCall('/settings');
                setSettings(result.data.settings);
            } catch (err) {
                // Non-admins can still use the Device tab (theme) even if settings load fails
                if (isAdmin) {
                    showError(`Failed to load settings: ${err.message}`);
                }
                // Set empty defaults so the page can still render
                setSettings({ scanTimeout: 30000, cacheTimeout: 300000 });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [showError, isAdmin]);


    const handleSettingChange = (key, value) => {
        const newSettings = {
            ...settings,
            [key]: value
        };
        setSettings(newSettings);

        // Only admins can save server settings
        if (isAdmin) {
            debouncedSave(newSettings);
        }
    };


    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
                    Settings
                </Typography>
                {autoSaving && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                            Auto-saving...
                        </Typography>
                    </Box>
                )}
            </Box>

            {settings && (
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            aria-label="settings tabs"
                            variant="scrollable"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                            sx={{
                                '& .MuiTabs-scrollButtons': {
                                    '&.Mui-disabled': { opacity: 0.3 }
                                }
                            }}
                        >
                            {tabsList.map((t, idx) => (
                                <Tab
                                    key={t.id}
                                    icon={t.icon}
                                    iconPosition="start"
                                    label={t.label}
                                    id={`settings-tab-${idx}`}
                                    aria-controls={`settings-tabpanel-${idx}`}
                                    sx={{
                                        minWidth: { xs: 'auto', sm: 120 },
                                        '& .MuiTab-iconWrapper': {
                                            display: { xs: 'none', sm: 'block' }
                                        }
                                    }}
                                />
                            ))}
                        </Tabs>
                    </Box>

                    {/* Server Settings Tab */}
                    {currentTabId === 'server' && (
                        <Box
                            role="tabpanel"
                            id="settings-tabpanel-server"
                            aria-labelledby="settings-tab-server"
                        >
                            <Grid container spacing={3}>
                                {/* Timing Settings */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <TimerIcon sx={{ mr: 1 }} />
                                                <Typography variant="h6">Timing Configuration</Typography>
                                            </Box>
                                            <Stack spacing={2}>
                                                <TextField
                                                    label="Scan Timeout (ms)"
                                                    type="number"
                                                    value={settings.scanTimeout}
                                                    onChange={(e) => handleSettingChange('scanTimeout', parseInt(e.target.value))}
                                                    fullWidth
                                                    helperText="Timeout for network scan operations"
                                                    InputProps={{
                                                        sx: {
                                                            '& input[type=number]': {
                                                                MozAppearance: 'textfield',
                                                            },
                                                            '& input[type=number]::-webkit-outer-spin-button': {
                                                                WebkitAppearance: 'none',
                                                                margin: 0,
                                                            },
                                                            '& input[type=number]::-webkit-inner-spin-button': {
                                                                WebkitAppearance: 'none',
                                                                margin: 0,
                                                            },
                                                        },
                                                    }}
                                                />
                                                <TextField
                                                    label="Cache Timeout (ms)"
                                                    type="number"
                                                    value={settings.cacheTimeout}
                                                    onChange={(e) => handleSettingChange('cacheTimeout', parseInt(e.target.value))}
                                                    fullWidth
                                                    helperText="How long to cache device status"
                                                    InputProps={{
                                                        sx: {
                                                            '& input[type=number]': {
                                                                MozAppearance: 'textfield',
                                                            },
                                                            '& input[type=number]::-webkit-outer-spin-button': {
                                                                WebkitAppearance: 'none',
                                                                margin: 0,
                                                            },
                                                            '& input[type=number]::-webkit-inner-spin-button': {
                                                                WebkitAppearance: 'none',
                                                                margin: 0,
                                                            },
                                                        },
                                                    }}
                                                />
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Network Settings */}
                                <Grid size={12}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <NetworkIcon sx={{ mr: 1 }} />
                                                <Typography variant="h6">Network Settings</Typography>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Configure network monitoring and scanning settings.
                                            </Typography>
                                            <Stack spacing={3}>
                                                <TextField
                                                    label="Cache Timeout (ms)"
                                                    value={settings?.cacheTimeout || ''}
                                                    onChange={(e) => handleSettingChange('cacheTimeout', parseInt(e.target.value) || 300000)}
                                                    type="number"
                                                    helperText="How long to cache system data before refreshing"
                                                    fullWidth
                                                />
                                                <TextField
                                                    label="Scan Timeout (ms)"
                                                    value={settings?.scanTimeout || ''}
                                                    onChange={(e) => handleSettingChange('scanTimeout', parseInt(e.target.value) || 30000)}
                                                    type="number"
                                                    helperText="Timeout for network scanning operations"
                                                    fullWidth
                                                />
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* Device/Appearance Settings Tab */}
                    {currentTabId === 'device' && (
                        <Box
                            role="tabpanel"
                            id="settings-tabpanel-device"
                            aria-labelledby="settings-tab-device"
                        >
                            <Grid container spacing={3}>
                                {/* Theme Settings */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <ThemeIcon sx={{ mr: 1 }} />
                                                <Typography variant="h6">Appearance</Typography>
                                            </Box>
                                            <Stack spacing={2}>
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                        Theme Mode
                                                    </Typography>
                                                    <ToggleButtonGroup
                                                        value={themeMode}
                                                        exclusive
                                                        onChange={(e, newMode) => newMode && setThemeMode(newMode)}
                                                        aria-label="theme mode"
                                                        fullWidth
                                                    >
                                                        <ToggleButton value="light" aria-label="light mode">
                                                            <LightIcon sx={{ mr: 1 }} />
                                                            Light
                                                        </ToggleButton>
                                                        <ToggleButton value="dark" aria-label="dark mode">
                                                            <DarkIcon sx={{ mr: 1 }} />
                                                            Dark
                                                        </ToggleButton>
                                                        <ToggleButton value="device" aria-label="device mode">
                                                            <DeviceIcon sx={{ mr: 1 }} />
                                                            Device
                                                        </ToggleButton>
                                                    </ToggleButtonGroup>
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                        Currently using: {actualMode} mode
                                                        {themeMode === 'device' && ' (following device preference)'}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* Users Management Tab */}
                    {currentTabId === 'users' && (
                        <Box
                            role="tabpanel"
                            id="settings-tabpanel-users"
                            aria-labelledby="settings-tab-users"
                        >
                            <UsersPanel currentUser={user} />
                        </Box>
                    )}
                </Box>
            )}
        </Container>
    );
};

export default Settings;
