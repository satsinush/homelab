// src/components/Settings.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
    Build as ServiceIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
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

const Settings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoSaving, setAutoSaving] = useState(false);
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [newService, setNewService] = useState({ name: '', displayName: '' });
    const [editingService, setEditingService] = useState(null);
    const [editingServiceIndex, setEditingServiceIndex] = useState(-1);
    const [tabValue, setTabValue] = useState(0);
    const { themeMode, setThemeMode, actualMode } = useThemeMode();
    const { showSuccess, showError } = useNotification();    // Auto-save debounced function
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
                setLoading(false);
            } catch (err) {
                showError(`Failed to load settings: ${err.message}`);
                setLoading(false);
            }
        };

        fetchSettings();
    }, [showError]);

    const handleSaveSettings = async () => {
        setAutoSaving(true);

        try {
            await tryApiCall('/settings', {
                method: 'PUT',
                data: settings
            });
            showSuccess('Settings saved successfully');
        } catch (err) {
            showError(`Failed to save settings: ${err.message}`);
        } finally {
            setAutoSaving(false);
        }
    };

    const handleSettingChange = (key, value) => {
        const newSettings = {
            ...settings,
            [key]: value
        };
        setSettings(newSettings);

        // Auto-save after change
        debouncedSave(newSettings);
    };

    const handleAddService = () => {
        if (!newService.name || !newService.displayName) return;

        const newSettings = {
            ...settings,
            services: [...settings.services, { ...newService }]
        };
        setSettings(newSettings);
        debouncedSave(newSettings);

        setNewService({ name: '', displayName: '' });
        setServiceDialogOpen(false);
    };

    const handleEditService = (index) => {
        setEditingService({ ...settings.services[index] });
        setEditingServiceIndex(index);
        setServiceDialogOpen(true);
    };

    const handleSaveEditedService = () => {
        if (!editingService.name || !editingService.displayName) return;

        const newSettings = {
            ...settings,
            services: settings.services.map((service, index) =>
                index === editingServiceIndex ? { ...editingService } : service
            )
        };
        setSettings(newSettings);
        debouncedSave(newSettings);

        setEditingService(null);
        setEditingServiceIndex(-1);
        setServiceDialogOpen(false);
    };

    const handleCancelServiceDialog = () => {
        setNewService({ name: '', displayName: '' });
        setEditingService(null);
        setEditingServiceIndex(-1);
        setServiceDialogOpen(false);
    };

    const handleRemoveService = (serviceIndex) => {
        const newSettings = {
            ...settings,
            services: settings.services.filter((_, index) => index !== serviceIndex)
        };
        setSettings(newSettings);
        debouncedSave(newSettings);
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const clearMessages = () => {
        // No longer needed with notification system
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
                            <Tab
                                icon={<ServerIcon />}
                                iconPosition="start"
                                label="Server"
                                id="settings-tab-0"
                                aria-controls="settings-tabpanel-0"
                                sx={{
                                    minWidth: { xs: 'auto', sm: 120 },
                                    '& .MuiTab-iconWrapper': {
                                        display: { xs: 'none', sm: 'block' }
                                    }
                                }}
                            />
                            <Tab
                                icon={<DevicesIcon />}
                                iconPosition="start"
                                label="Device"
                                id="settings-tab-1"
                                aria-controls="settings-tabpanel-1"
                                sx={{
                                    minWidth: { xs: 'auto', sm: 120 },
                                    '& .MuiTab-iconWrapper': {
                                        display: { xs: 'none', sm: 'block' }
                                    }
                                }}
                            />
                            <Tab
                                icon={<UserIcon />}
                                iconPosition="start"
                                label="User"
                                id="settings-tab-2"
                                aria-controls="settings-tabpanel-2"
                                sx={{
                                    minWidth: { xs: 'auto', sm: 120 },
                                    '& .MuiTab-iconWrapper': {
                                        display: { xs: 'none', sm: 'block' }
                                    }
                                }}
                            />
                        </Tabs>
                    </Box>

                    {/* Server Settings Tab */}
                    <Box
                        role="tabpanel"
                        hidden={tabValue !== 0}
                        id="settings-tabpanel-0"
                        aria-labelledby="settings-tab-0"
                    >
                        {tabValue === 0 && (
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

                                {/* Service Management */}
                                <Grid size={12}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <ServiceIcon sx={{ mr: 1 }} />
                                                    <Typography variant="h6">Service Monitoring</Typography>
                                                </Box>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => setServiceDialogOpen(true)}
                                                >
                                                    Add Service
                                                </Button>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Configure which services to monitor for status checking. All services in this list will be monitored.
                                            </Typography>
                                            <List>
                                                {settings.services?.map((service, index) => (
                                                    <ListItem
                                                        key={service.name}
                                                        divider
                                                        secondaryAction={
                                                            <Box>
                                                                <IconButton
                                                                    edge="end"
                                                                    aria-label="edit"
                                                                    onClick={() => handleEditService(index)}
                                                                    sx={{ mr: 1 }}
                                                                >
                                                                    <EditIcon />
                                                                </IconButton>
                                                                <IconButton
                                                                    edge="end"
                                                                    aria-label="delete"
                                                                    onClick={() => handleRemoveService(index)}
                                                                >
                                                                    <DeleteIcon />
                                                                </IconButton>
                                                            </Box>
                                                        }
                                                    >
                                                        <ListItemText
                                                            primary={service.displayName}
                                                            secondary={`Service: ${service.name}`}
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                            {settings.services?.length === 0 && (
                                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                                    No services configured. Add services to monitor their status.
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        )}
                    </Box>

                    {/* Device Settings Tab */}
                    <Box
                        role="tabpanel"
                        hidden={tabValue !== 1}
                        id="settings-tabpanel-1"
                        aria-labelledby="settings-tab-1"
                    >
                        {tabValue === 1 && (
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
                        )}
                    </Box>

                    {/* User Settings Tab */}
                    <Box
                        role="tabpanel"
                        hidden={tabValue !== 2}
                        id="settings-tabpanel-2"
                        aria-labelledby="settings-tab-2"
                    >
                        {tabValue === 2 && (
                            <Grid container spacing={3}>
                                {/* Placeholder for future user settings */}
                                <Grid size={12}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <SecurityIcon sx={{ mr: 1 }} />
                                                <Typography variant="h6">User Preferences</Typography>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary">
                                                User-specific settings will be available in future updates.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                </Box>
            )}

            {/* Add/Edit Service Dialog */}
            <Dialog open={serviceDialogOpen} onClose={handleCancelServiceDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Service Name"
                            value={editingService ? editingService.name : newService.name}
                            onChange={(e) => {
                                if (editingService) {
                                    setEditingService(prev => ({ ...prev, name: e.target.value }));
                                } else {
                                    setNewService(prev => ({ ...prev, name: e.target.value }));
                                }
                            }}
                            fullWidth
                            helperText="System service name (e.g., nginx, sshd)"
                        />
                        <TextField
                            label="Display Name"
                            value={editingService ? editingService.displayName : newService.displayName}
                            onChange={(e) => {
                                if (editingService) {
                                    setEditingService(prev => ({ ...prev, displayName: e.target.value }));
                                } else {
                                    setNewService(prev => ({ ...prev, displayName: e.target.value }));
                                }
                            }}
                            fullWidth
                            helperText="Friendly name to display in the dashboard"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelServiceDialog}>Cancel</Button>
                    <Button
                        onClick={editingService ? handleSaveEditedService : handleAddService}
                        variant="contained"
                        disabled={
                            editingService
                                ? !editingService.name || !editingService.displayName
                                : !newService.name || !newService.displayName
                        }
                    >
                        {editingService ? 'Save Changes' : 'Add Service'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Settings;
