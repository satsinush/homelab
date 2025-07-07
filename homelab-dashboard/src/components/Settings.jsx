// src/components/Settings.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Alert,
    CircularProgress,
    Container,
    Paper,
    Switch,
    FormControlLabel,
    Button,
    TextField,
    Grid,
    Divider,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Notifications as NotificationsIcon,
    Security as SecurityIcon,
    Api as ApiIcon,
    Palette as ThemeIcon,
    Info as InfoIcon,
    Save as SaveIcon,
    RestartAlt as ResetIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';

const Settings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [localSettings, setLocalSettings] = useState({
        autoRefresh: true,
        refreshInterval: 5000,
        darkMode: false,
        notifications: true,
        apiTimeout: 10000
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setError('');
                const result = await tryApiCall('/settings');
                setSettings(result.data);
                setLoading(false);
            } catch (err) {
                setError('Unable to connect to API server - Settings not available');
                setLoading(false);

                // Load local settings from localStorage
                const saved = localStorage.getItem('homelabSettings');
                if (saved) {
                    setLocalSettings(JSON.parse(saved));
                }
            }
        };

        fetchSettings();
    }, []);

    const handleLocalSettingChange = (key, value) => {
        const updated = { ...localSettings, [key]: value };
        setLocalSettings(updated);
        localStorage.setItem('homelabSettings', JSON.stringify(updated));
    };

    const resetSettings = () => {
        const defaults = {
            autoRefresh: true,
            refreshInterval: 5000,
            darkMode: false,
            notifications: true,
            apiTimeout: 10000
        };
        setLocalSettings(defaults);
        localStorage.setItem('homelabSettings', JSON.stringify(defaults));
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'calc(100vh - 200px)',
                    py: 8
                }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading settings...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Settings
                </Typography>
                <Typography variant="h6" color="text.secondary">
                    Configure your homelab dashboard preferences
                </Typography>
            </Box>

            {error && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Server settings unavailable - using local configuration
                    </Typography>
                    <Typography variant="body2">
                        {error}
                    </Typography>
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Dashboard Settings */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Dashboard Settings
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localSettings.autoRefresh}
                                            onChange={(e) => handleLocalSettingChange('autoRefresh', e.target.checked)}
                                        />
                                    }
                                    label="Auto-refresh data"
                                />

                                <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Refresh Interval (seconds)
                                    </Typography>
                                    <TextField
                                        type="number"
                                        value={localSettings.refreshInterval / 1000}
                                        onChange={(e) => handleLocalSettingChange('refreshInterval', parseInt(e.target.value) * 1000)}
                                        disabled={!localSettings.autoRefresh}
                                        fullWidth
                                        size="small"
                                        inputProps={{ min: 1, max: 60 }}
                                    />
                                </Box>

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localSettings.notifications}
                                            onChange={(e) => handleLocalSettingChange('notifications', e.target.checked)}
                                        />
                                    }
                                    label="Enable notifications"
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* API Settings */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                <ApiIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    API Configuration
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        API Timeout (milliseconds)
                                    </Typography>
                                    <TextField
                                        type="number"
                                        value={localSettings.apiTimeout}
                                        onChange={(e) => handleLocalSettingChange('apiTimeout', parseInt(e.target.value))}
                                        fullWidth
                                        size="small"
                                        inputProps={{ min: 1000, max: 30000, step: 1000 }}
                                    />
                                </Box>

                                <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Current API Status
                                    </Typography>
                                    <Chip
                                        label={window.workingApiUrl ? "Connected" : "Disconnected"}
                                        color={window.workingApiUrl ? "success" : "error"}
                                        icon={<ApiIcon />}
                                    />
                                    {window.workingApiUrl && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontFamily: 'monospace' }}>
                                            {window.workingApiUrl}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Theme Settings */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                <ThemeIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Appearance
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localSettings.darkMode}
                                            onChange={(e) => handleLocalSettingChange('darkMode', e.target.checked)}
                                            disabled={true} // Not yet implemented
                                        />
                                    }
                                    label="Dark mode (Coming Soon)"
                                />

                                <Alert severity="info">
                                    Dark mode support will be added in a future update.
                                </Alert>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* System Information */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                <InfoIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    System Information
                                </Typography>
                            </Box>

                            <List sx={{ py: 0 }}>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary="Dashboard Version"
                                        secondary="1.0.0"
                                    />
                                </ListItem>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary="Last Updated"
                                        secondary={new Date().toLocaleDateString()}
                                    />
                                </ListItem>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary="Browser"
                                        secondary={navigator.userAgent.split(' ')[0]}
                                    />
                                </ListItem>
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Server Settings (if available) */}
                {settings && (
                    <Grid size={{ xs: 12 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    Server Configuration
                                </Typography>
                                <Alert severity="info">
                                    Server-side settings are read-only from this interface.
                                </Alert>
                                <Box sx={{ mt: 2 }}>
                                    <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '4px', overflow: 'auto' }}>
                                        {JSON.stringify(settings, null, 2)}
                                    </pre>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                    variant="outlined"
                    startIcon={<ResetIcon />}
                    onClick={resetSettings}
                >
                    Reset to Defaults
                </Button>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => {
                        // Settings are automatically saved to localStorage
                        alert('Settings saved successfully!');
                    }}
                >
                    Save Settings
                </Button>
            </Box>

            {/* Info Section */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.50' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About Settings
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Settings are automatically saved to your browser's local storage.
                    Server-side configuration requires API connectivity and appropriate permissions.
                    Changes to refresh intervals and API timeouts will take effect immediately.
                </Typography>
            </Paper>
        </Container>
    );
};

export default Settings;
