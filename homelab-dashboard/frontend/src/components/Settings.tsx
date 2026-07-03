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
    TextField,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Grid,
    Tabs,
    Tab,
    Switch,
    FormControlLabel,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    FormHelperText
} from '@mui/material';
import {
    Timer as TimerIcon,
    Cloud as ServerIcon,
    Devices as DevicesIcon,
    Person as UserIcon,
    Palette as ThemeIcon,
    LightMode as LightIcon,
    DarkMode as DarkIcon,
    SettingsBrightness as DeviceIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { ServerSettings, UserSettings } from '../types/api';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/useAuth';

const Settings = () => {
    const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const { themeMode, setThemeMode, actualMode } = useThemeMode();
    const { showSuccess, showError } = useNotification();
    const { hasPermission } = useAuth();
    const canManageSettings = hasPermission('dashboard-settings-user');

    const tabsList = useMemo(() => {
        const list = [];
        if (canManageSettings) {
            list.push({ id: 'system', label: 'System', icon: <ServerIcon /> });
        }
        list.push({ id: 'user', label: 'User', icon: <UserIcon /> });
        list.push({ id: 'device', label: 'Device', icon: <DevicesIcon /> });
        return list;
    }, [canManageSettings]);

    // Adjust tabValue if it gets out of bounds
    useEffect(() => {
        if (tabValue >= tabsList.length) {
            setTabValue(0);
        }
    }, [tabsList, tabValue]);

    const currentTabId = tabsList[tabValue]?.id || 'user';

    // Debounce utility function
    function debounce(func: (...args: unknown[]) => void, wait: number) {
        let timeout: ReturnType<typeof setTimeout>;
        return function executedFunction(...args: unknown[]) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Auto-save server settings (admin only)
    const debouncedSaveServer = useMemo(
        () => debounce(async (settingsToSave: unknown) => {
            setAutoSaving(true);
            try {
                await tryApiCall('/settings', {
                    method: 'PUT',
                    data: settingsToSave
                });
                showSuccess('System settings saved');
            } catch (err) {
                const error = err as Error;
                showError(`Failed to save system settings: ${error.message}`);
            } finally {
                setAutoSaving(false);
            }
        }, 1000),
        [showSuccess, showError]
    );

    // Auto-save user settings
    const debouncedSaveUser = useMemo(
        () => debounce(async (settingsToSave: unknown) => {
            setAutoSaving(true);
            try {
                await tryApiCall('/user-settings', {
                    method: 'PUT',
                    data: settingsToSave
                });
                showSuccess('User settings saved');
            } catch (err) {
                const error = err as Error;
                showError(`Failed to save user settings: ${error.message}`);
            } finally {
                setAutoSaving(false);
            }
        }, 1000),
        [showSuccess, showError]
    );

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [serverRes, userRes] = await Promise.all([
                    tryApiCall('/settings').catch(() => null),
                    tryApiCall('/user-settings').catch(() => null)
                ]);
                setServerSettings(serverRes?.data?.settings || { scanTimeout: 30000, cacheTimeout: 300000 });
                setUserSettings(userRes?.data?.settings || {});
            } catch (err) {
                const error = err as Error;
                showError(`Failed to load settings: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [showError]);

    const handleServerSettingChange = (key: string, value: unknown) => {
        const newSettings = { ...(serverSettings || {}), [key]: value };
        setServerSettings(newSettings);
        if (canManageSettings) {
            debouncedSaveServer(newSettings);
        }
    };

    const handleUserSettingChange = (key: string, value: unknown) => {
        const newSettings = { ...(userSettings || {}), [key]: value };
        setUserSettings(newSettings);
        debouncedSaveUser(newSettings);
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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

                {/* System Settings Tab (Admin Only) */}
                {currentTabId === 'system' && serverSettings && (
                    <Box role="tabpanel" id="settings-tabpanel-system">
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
                                                value={serverSettings.scanTimeout}
                                                onChange={(e) => handleServerSettingChange('scanTimeout', parseInt(e.target.value))}
                                                fullWidth
                                                helperText="Timeout for network scan operations"
                                                InputProps={{
                                                    sx: {
                                                        '& input[type=number]': { MozAppearance: 'textfield' },
                                                        '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                    },
                                                }}
                                            />
                                            <TextField
                                                label="Cache Timeout (ms)"
                                                type="number"
                                                value={serverSettings.cacheTimeout}
                                                onChange={(e) => handleServerSettingChange('cacheTimeout', parseInt(e.target.value))}
                                                fullWidth
                                                helperText="How long to cache device status"
                                                InputProps={{
                                                    sx: {
                                                        '& input[type=number]': { MozAppearance: 'textfield' },
                                                        '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                    },
                                                }}
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* User Settings Tab */}
                {currentTabId === 'user' && userSettings && (
                    <Box role="tabpanel" id="settings-tabpanel-user">
                        <Grid container spacing={3}>
                            {/* Navigation Preferences */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <UserIcon sx={{ mr: 1 }} />
                                            <Typography variant="h6">Navigation</Typography>
                                        </Box>
                                        <Stack spacing={2}>
                                            <FormControl fullWidth>
                                                <InputLabel>Default Home Page</InputLabel>
                                                <Select
                                                    value={userSettings.defaultHomePage || 'home'}
                                                    label="Default Home Page"
                                                    onChange={(e) => handleUserSettingChange('defaultHomePage', e.target.value)}
                                                >
                                                    <MenuItem value="home">Home Dashboard</MenuItem>
                                                    <MenuItem value="devices">Devices</MenuItem>
                                                </Select>
                                                <FormHelperText>Page shown when you first sign in</FormHelperText>
                                            </FormControl>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Device List Preferences */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <DevicesIcon sx={{ mr: 1 }} />
                                            <Typography variant="h6">Device List</Typography>
                                        </Box>
                                        <Stack spacing={2}>
                                            <FormControl fullWidth>
                                                <InputLabel>Default View</InputLabel>
                                                <Select
                                                    value={userSettings.deviceListView || 'grid'}
                                                    label="Default View"
                                                    onChange={(e) => handleUserSettingChange('deviceListView', e.target.value)}
                                                >
                                                    <MenuItem value="grid">Grid</MenuItem>
                                                    <MenuItem value="list">List</MenuItem>
                                                </Select>
                                                <FormHelperText>How devices are displayed by default</FormHelperText>
                                            </FormControl>
                                            <TextField
                                                label="Devices Per Page"
                                                type="number"
                                                value={userSettings.devicesPerPage || 25}
                                                onChange={(e) => handleUserSettingChange('devicesPerPage', Math.max(5, Math.min(100, parseInt(e.target.value) || 25)))}
                                                fullWidth
                                                helperText="Number of devices shown per page (5-100)"
                                                InputProps={{
                                                    sx: {
                                                        '& input[type=number]': { MozAppearance: 'textfield' },
                                                        '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                    },
                                                }}
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={Boolean(userSettings.showOfflineDevices ?? true)}
                                                        onChange={(e) => handleUserSettingChange('showOfflineDevices', e.target.checked)}
                                                    />
                                                }
                                                label="Show offline devices"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={Boolean(userSettings.compactMode ?? false)}
                                                        onChange={(e) => handleUserSettingChange('compactMode', e.target.checked)}
                                                    />
                                                }
                                                label="Compact mode"
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* Device Settings Tab (localStorage) */}
                {currentTabId === 'device' && (
                    <Box role="tabpanel" id="settings-tabpanel-device">
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Device settings are stored locally on this browser and not synced across devices.
                        </Alert>
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
            </Box>
        </Container>
    );
};

export default Settings;
