// src/components/Devices.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    Grid,
    Chip,
    Alert,
    CircularProgress,
    Container,
    Paper,
    Divider,
    Stack
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Computer as ComputerIcon,
    Laptop as LaptopIcon,
    Router as RouterIcon,
    Smartphone as PhoneIcon,
    Print as PrintIcon,
    Videocam as CameraIcon,
    Memory as ServerIcon,
    PowerSettingsNew as PowerIcon,
    CheckCircle as OnlineIcon,
    Cancel as OfflineIcon
} from '@mui/icons-material';
import { tryApiCall, apiCall } from '../utils/api';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [deviceStatuses, setDeviceStatuses] = useState({});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshingDevices, setRefreshingDevices] = useState(new Set());

    useEffect(() => {
        const fetchDevicesAndStatus = async () => {
            try {
                setError(''); // Clear any previous errors

                // Fetch device statuses (this includes all device info)
                const statusResult = await tryApiCall('/devices/status');

                // Extract device keys for the devices list (use deviceKey which is MAC or IP)
                const deviceKeys = statusResult.data.devices.map(device => device.deviceKey || device.mac || device.ip);
                setDevices(deviceKeys);

                // Map device statuses using deviceKey as key
                const statusMap = {};
                statusResult.data.devices.forEach(device => {
                    const deviceKey = device.deviceKey || device.mac || device.ip;
                    statusMap[deviceKey] = {
                        status: device.status,
                        ip: device.ip,
                        mac: device.mac,
                        vendor: device.vendor,
                        networkName: device.networkName,
                        wolEnabled: device.wolEnabled,
                        friendlyName: device.friendlyName // Keep friendly name for display
                    };
                });
                setDeviceStatuses(statusMap);
                setLoading(false);

                // Store working API URL for future requests
                window.workingApiUrl = statusResult.baseUrl;

            } catch (err) {
                console.error('All API endpoints failed:', err);
                setError(`Failed to connect to API server. Tried multiple endpoints. Error: ${err.message}`);
                setLoading(false);

                // Set some dummy data for development/testing
                setDevices(['Andrew-Computer']);
                setDeviceStatuses({
                    'Andrew-Computer': { status: 'unknown', ip: '10.10.10.13' }
                });
            }
        };

        fetchDevicesAndStatus();

        // Refresh device status every 30 seconds, but only if we have a working API
        const interval = setInterval(async () => {
            if (window.workingApiUrl) {
                try {
                    const response = await apiCall(window.workingApiUrl, '/devices/status');
                    const statusMap = {};
                    response.devices.forEach(device => {
                        const deviceKey = device.deviceKey || device.mac || device.ip;
                        statusMap[deviceKey] = {
                            status: device.status,
                            ip: device.ip,
                            mac: device.mac,
                            vendor: device.vendor,
                            networkName: device.networkName,
                            wolEnabled: device.wolEnabled,
                            friendlyName: device.friendlyName // Keep friendly name for display
                        };
                    });
                    setDeviceStatuses(statusMap);
                } catch (err) {
                    // Don't show error to user for refresh failures
                }
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleWakeOnLan = async (deviceKey) => {
        setMessage('');
        setError('');

        // Get device info to find the friendly name for WOL
        const deviceInfo = deviceStatuses[deviceKey];
        const deviceName = deviceInfo?.friendlyName || deviceKey;

        try {
            const result = await tryApiCall('/wol', {
                method: 'POST',
                data: { device: deviceName },
                timeout: 10000
            });
            setMessage(`Wake-on-LAN packet sent to ${deviceName} successfully!`);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
            setError(`Failed to send WoL packet to ${deviceName}: ${errorMsg}`);
        }
    };

    const handleRefreshDevice = async (deviceKey) => {
        if (!window.workingApiUrl) return;

        // Get device IP from device statuses
        const deviceInfo = deviceStatuses[deviceKey];
        if (!deviceInfo?.ip) {
            console.warn(`No IP found for device: ${deviceKey}`);
            return;
        }

        // Add device to refreshing set
        setRefreshingDevices(prev => new Set([...prev, deviceKey]));

        try {
            const response = await apiCall(window.workingApiUrl, `/device-status/${deviceInfo.ip}`);
            setDeviceStatuses(prev => ({
                ...prev,
                [deviceKey]: {
                    status: response.status,
                    ip: response.ip,
                    mac: response.mac,
                    vendor: response.vendor,
                    networkName: response.networkName,
                    wolEnabled: response.wolEnabled,
                    friendlyName: response.friendlyName
                }
            }));
        } catch (err) {
            // Handle refresh error silently or show a message
        } finally {
            // Remove device from refreshing set
            setRefreshingDevices(prev => {
                const newSet = new Set(prev);
                newSet.delete(deviceKey);
                return newSet;
            });
        }
    };

    const clearMessages = () => {
        setMessage('');
        setError('');
    };

    const getDeviceTypeIcon = (deviceName) => {
        const name = deviceName.toLowerCase();
        if (name.includes('computer') || name.includes('pc') || name.includes('desktop')) return <ComputerIcon />;
        if (name.includes('laptop')) return <LaptopIcon />;
        if (name.includes('server')) return <ServerIcon />;
        if (name.includes('phone') || name.includes('mobile')) return <PhoneIcon />;
        if (name.includes('tablet') || name.includes('ipad')) return <PhoneIcon />;
        if (name.includes('router') || name.includes('gateway')) return <RouterIcon />;
        if (name.includes('camera') || name.includes('cam')) return <CameraIcon />;
        if (name.includes('printer')) return <PrintIcon />;
        return <ComputerIcon />; // Default
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
                        Loading devices...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
            {/* Header Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                    WOL Devices
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    Monitor and wake up configured devices on your network
                </Typography>

                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#f8fafc' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                {devices.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                WOL Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#f0fdf4' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main', mb: 1 }}>
                                {Object.values(deviceStatuses).filter(d => d.status === 'online').length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Online
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#fef2f2' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main', mb: 1 }}>
                                {Object.values(deviceStatuses).filter(d => d.status === 'offline').length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Offline
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Messages */}
            {(message || error) && (
                <Box sx={{ mb: 3 }}>
                    {error && (
                        <Alert severity="error" onClose={clearMessages} sx={{ mb: 1 }}>
                            {error}
                        </Alert>
                    )}
                    {message && (
                        <Alert severity="success" onClose={clearMessages}>
                            {message}
                        </Alert>
                    )}
                </Box>
            )}

            {/* Content */}
            {devices.length > 0 ? (
                <Grid container spacing={3}>
                    {devices.map(device => {
                        const deviceInfo = deviceStatuses[device] || {};
                        const isOnline = deviceInfo.status === 'online';
                        const isRefreshing = refreshingDevices.has(device);

                        return (
                            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={device}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        {/* Device Header */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                    {getDeviceTypeIcon(deviceInfo.friendlyName || device)}
                                                    {isOnline ? (
                                                        <OnlineIcon sx={{ color: 'success.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                    ) : (
                                                        <OfflineIcon sx={{ color: 'error.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                    )}
                                                </Box>
                                            </Box>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleRefreshDevice(device)}
                                                disabled={isRefreshing}
                                                sx={{
                                                    color: 'secondary.main',
                                                    '&:disabled': { color: 'action.disabled' }
                                                }}
                                            >
                                                <RefreshIcon sx={{
                                                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                                                    '@keyframes spin': {
                                                        '0%': { transform: 'rotate(0deg)' },
                                                        '100%': { transform: 'rotate(360deg)' }
                                                    }
                                                }} />
                                            </IconButton>
                                        </Box>                        {/* Device Info */}
                                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                            {deviceInfo.friendlyName || device}
                                        </Typography>

                                        <Chip
                                            label={isOnline ? 'Online' : 'Offline'}
                                            color={isOnline ? 'success' : 'error'}
                                            size="small"
                                            sx={{ mb: 2 }}
                                        />

                                        {/* Device Details */}
                                        <Stack spacing={1} sx={{ mb: 3 }}>
                                            {deviceInfo.ip && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">IP:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{deviceInfo.ip}</Typography>
                                                </Box>
                                            )}
                                            {deviceInfo.mac && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">MAC:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{deviceInfo.mac}</Typography>
                                                </Box>
                                            )}
                                            {deviceInfo.vendor && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Vendor:</Typography>
                                                    <Typography variant="body2">{deviceInfo.vendor}</Typography>
                                                </Box>
                                            )}
                                            {deviceInfo.networkName && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Network:</Typography>
                                                    <Typography variant="body2">{deviceInfo.networkName}</Typography>
                                                </Box>
                                            )}
                                            {deviceInfo.wolEnabled !== undefined && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">WOL:</Typography>
                                                    <Chip
                                                        label={deviceInfo.wolEnabled ? 'Enabled' : 'Disabled'}
                                                        size="small"
                                                        color={deviceInfo.wolEnabled ? 'success' : 'default'}
                                                        variant="outlined"
                                                    />
                                                </Box>
                                            )}
                                        </Stack>
                                    </CardContent>

                                    {/* Actions */}
                                    <Divider />
                                    <Box sx={{ p: 2 }}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            startIcon={<PowerIcon />}
                                            onClick={() => handleWakeOnLan(device)}
                                            color="primary"
                                        >
                                            {'Wake Device'}
                                        </Button>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <ComputerIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                        No WOL Devices Configured
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No Wake-on-LAN devices are configured or failed to load devices from the server.
                    </Typography>
                </Paper>
            )}

            {/* Info Section */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.50' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About WOL Device Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    This page shows all configured Wake-on-LAN devices. Each device is checked via ARP scan
                    to determine if it's currently online (has an IP address) or offline. You can wake up any
                    device using the Wake-on-LAN button. Device status is automatically refreshed every 30 seconds.
                </Typography>
            </Paper>
        </Container>
    );
};

export default Devices;
