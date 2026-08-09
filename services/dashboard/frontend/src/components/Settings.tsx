// src/components/Settings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
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
    Button,
    Chip,
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
    SettingsBrightness as DeviceIcon,
    Settings as SettingsIcon,
    InfoOutlined as InfoIcon,
    Sync as SyncIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { ServerSettings, UserSettings } from '../types/api';
import { useThemeMode } from '../contexts/useThemeMode';
import { useNotification } from '../contexts/useNotification';
import { useAuth } from '../contexts/useAuth';

import { getErrorMessage } from '../utils/errors';
import { allowedDefaultHomePages, resolveDefaultHome } from '../utils/navPages';
import { version as appVersion } from '../../package.json';

const Settings = () => {
    const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [checkingRelease, setCheckingRelease] = useState(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const { themeMode, setThemeMode, actualMode } = useThemeMode();
    const { showSuccess, showError } = useNotification();
    const { hasPermission, user } = useAuth();
    const canManageSettings = hasPermission('dashboard-settings-user');
    const homePageOptions = useMemo(
        () => allowedDefaultHomePages(hasPermission),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- roles drive permission set
        [user?.roles]
    );

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
                showError(`Failed to save system settings: ${getErrorMessage(err)}`);
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
                showError(`Failed to save user settings: ${getErrorMessage(err)}`);
            } finally {
                setAutoSaving(false);
            }
        }, 1000),
        [showSuccess, showError]
    );

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [serverRes, userRes, versionRes] = await Promise.all([
                    tryApiCall<{ settings: ServerSettings }>('/settings').catch(() => null),
                    tryApiCall<{ settings: UserSettings }>('/user-settings').catch(() => null),
                    tryApiCall<{ latestVersion: string }>('/system/version').catch(() => null)
                ]);
                if (versionRes?.data?.latestVersion) {
                    setLatestVersion(versionRes.data.latestVersion);
                }
                setServerSettings(serverRes?.data?.settings || { scanTimeout: 30000, cacheTimeout: 300000 });
                let loaded = userRes?.data?.settings || {};
                const stored =
                    typeof loaded.defaultHomePage === 'string' ? loaded.defaultHomePage : 'home';
                const { pageId, reset } = resolveDefaultHome(stored, hasPermission);
                if (reset) {
                    loaded = { ...loaded, defaultHomePage: pageId };
                    try {
                        await tryApiCall('/user-settings', {
                            method: 'PUT',
                            data: loaded,
                        });
                    } catch {
                        /* keep local reset even if save fails */
                    }
                }
                setUserSettings(loaded);
            } catch (err) {
                showError(`Failed to load settings: ${getErrorMessage(err)}`);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- roles drive permission set
    }, [showError, user?.roles]);

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
            <PageHeader
                title="Settings"
                icon={<SettingsIcon />}
                actions={autoSaving && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                            Auto-saving...
                        </Typography>
                    </Box>
                )}
            />

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
                                                value={serverSettings.scanTimeout === undefined || isNaN(Number(serverSettings.scanTimeout)) ? '' : serverSettings.scanTimeout}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        handleServerSettingChange('scanTimeout', '');
                                                    } else {
                                                        const num = parseInt(val, 10);
                                                        if (!isNaN(num)) {
                                                            handleServerSettingChange('scanTimeout', num);
                                                        }
                                                    }
                                                }}
                                                onBlur={() => {
                                                    let num = parseInt(String(serverSettings.scanTimeout), 10);
                                                    if (isNaN(num) || num < 1000) {
                                                        num = 1000;
                                                    }
                                                    handleServerSettingChange('scanTimeout', num);
                                                }}
                                                fullWidth
                                                helperText="Timeout for network scan operations"
                                                slotProps={{
                                                    input: {
                                                        sx: {
                                                            '& input[type=number]': { MozAppearance: 'textfield' },
                                                            '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                            '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        },
                                                    }
                                                }}
                                            />
                                            <TextField
                                                label="Cache Timeout (ms)"
                                                type="number"
                                                value={serverSettings.cacheTimeout === undefined || isNaN(Number(serverSettings.cacheTimeout)) ? '' : serverSettings.cacheTimeout}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        handleServerSettingChange('cacheTimeout', '');
                                                    } else {
                                                        const num = parseInt(val, 10);
                                                        if (!isNaN(num)) {
                                                            handleServerSettingChange('cacheTimeout', num);
                                                        }
                                                    }
                                                }}
                                                onBlur={() => {
                                                    let num = parseInt(String(serverSettings.cacheTimeout), 10);
                                                    if (isNaN(num) || num < 0) {
                                                        num = 0;
                                                    }
                                                    handleServerSettingChange('cacheTimeout', num);
                                                }}
                                                fullWidth
                                                helperText="How long to cache device status"
                                                slotProps={{
                                                    input: {
                                                        sx: {
                                                            '& input[type=number]': { MozAppearance: 'textfield' },
                                                            '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                            '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        },
                                                    }
                                                }}
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* About & Version Sync Card */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <InfoIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6">About & Release</Typography>
                                        </Box>
                                        <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="text.secondary">Current Version</Typography>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip label={`v${appVersion}`} size="small" color="primary" sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
                                                    {latestVersion && latestVersion.replace(/^v/, '') === appVersion && (
                                                        <Chip label="Up to date" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
                                                    )}
                                                </Stack>
                                            </Box>
                                            {latestVersion && latestVersion.replace(/^v/, '') !== appVersion && (
                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
                                                        Update Available
                                                    </Typography>
                                                    <Chip
                                                        label={latestVersion}
                                                        size="small"
                                                        color="warning"
                                                        sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                                                    />
                                                </Box>
                                            )}
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="text.secondary">Repository</Typography>
                                                <Typography
                                                    component="a"
                                                    href="https://github.com/satsinush/homelab"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    variant="body2"
                                                    color="primary"
                                                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                                >
                                                    github.com/satsinush/homelab
                                                </Typography>
                                            </Box>
                                            <Box sx={{ mt: 'auto', pt: 2 }}>
                                                <Button
                                                    variant="outlined"
                                                    fullWidth
                                                    startIcon={<SyncIcon sx={{ animation: checkingRelease ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />}
                                                    onClick={async () => {
                                                        setCheckingRelease(true);
                                                        try {
                                                            const res = await tryApiCall<{ latestVersion: string; hasUpdate: boolean }>(
                                                                '/system/version-check',
                                                                { method: 'POST' }
                                                            );
                                                            const tag = res.data?.latestVersion || `v${appVersion}`;
                                                            setLatestVersion(tag);
                                                            if (res.data?.hasUpdate) {
                                                                showSuccess(`New release available: ${tag}`);
                                                            } else {
                                                                showSuccess(`Homelab is up to date! (${tag})`);
                                                            }
                                                        } catch {
                                                            setLatestVersion(`v${appVersion}`);
                                                            showSuccess(`Version checked: v${appVersion} (Up to date)`);
                                                        } finally {
                                                            setCheckingRelease(false);
                                                        }
                                                    }}
                                                    disabled={checkingRelease}
                                                >
                                                    {checkingRelease ? 'Checking Release...' : 'Check / Sync Release'}
                                                </Button>
                                            </Box>
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
                                                    value={
                                                        homePageOptions.some(
                                                            (p) => p.id === (userSettings.defaultHomePage || 'home')
                                                        )
                                                            ? userSettings.defaultHomePage || 'home'
                                                            : 'home'
                                                    }
                                                    label="Default Home Page"
                                                    onChange={(e) => handleUserSettingChange('defaultHomePage', e.target.value)}
                                                >
                                                    {homePageOptions.map((page) => (
                                                        <MenuItem key={page.id} value={page.id}>
                                                            {page.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                                <FormHelperText>
                                                    Opened after sign-in (and when you visit the site root). Resets to Home if you lose access to the chosen page.
                                                </FormHelperText>
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
                                                    value={
                                                        userSettings.deviceListView === 'list' ||
                                                        userSettings.deviceListView === 'table'
                                                            ? 'list'
                                                            : 'grid'
                                                    }
                                                    label="Default View"
                                                    onChange={(e) => handleUserSettingChange('deviceListView', e.target.value)}
                                                >
                                                    <MenuItem value="grid">Grid (cards)</MenuItem>
                                                    <MenuItem value="list">List (table)</MenuItem>
                                                </Select>
                                                <FormHelperText>
                                                    Default Devices layout (synced to your account; the page toggle updates this too)
                                                </FormHelperText>
                                            </FormControl>
                                            <TextField
                                                label="Devices Per Page"
                                                type="number"
                                                value={userSettings.devicesPerPage === undefined || userSettings.devicesPerPage === '' ? '' : userSettings.devicesPerPage}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        handleUserSettingChange('devicesPerPage', '');
                                                    } else {
                                                        const num = parseInt(val, 10);
                                                        if (!isNaN(num)) {
                                                            handleUserSettingChange('devicesPerPage', num);
                                                        }
                                                    }
                                                }}
                                                onBlur={() => {
                                                    let num = parseInt(String(userSettings.devicesPerPage), 10);
                                                    if (isNaN(num) || num < 5) {
                                                        num = 25; // Default/Min fallback
                                                    } else if (num > 100) {
                                                        num = 100;
                                                    }
                                                    handleUserSettingChange('devicesPerPage', num);
                                                }}
                                                fullWidth
                                                helperText="Pagination size on the Devices page (5-100)"
                                                slotProps={{
                                                    input: {
                                                        sx: {
                                                            '& input[type=number]': { MozAppearance: 'textfield' },
                                                            '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                            '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                                        },
                                                    }
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
