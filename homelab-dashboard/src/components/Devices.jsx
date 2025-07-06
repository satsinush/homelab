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

                // Try to fetch devices list first (use names endpoint for backward compatibility)
                const devicesResult = await tryApiCall('/devices/names');
                setDevices(devicesResult.data);

                // Then try to fetch device statuses
                const statusResult = await tryApiCall('/devices/status');
                const statusMap = {};
                statusResult.data.devices.forEach(device => {
                    // Use overall status and find primary IP (prefer local, then first available)
                    statusMap[device.device] = {
                        status: device.overallStatus,
                        ips: device.ips,
                        mac: device.mac
                    };
                });
                setDeviceStatuses(statusMap);
                setLoading(false);

                // Store working API URL for future requests
                window.workingApiUrl = devicesResult.baseUrl;

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
                        // Use overall status and find primary IP (prefer local, then first available)
                        statusMap[device.device] = {
                            status: device.overallStatus,
                            ips: device.ips,
                            mac: device.mac
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

    const handleWakeOnLan = async (deviceName) => {
        setMessage('');
        setError('');

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

    const handleRefreshDevice = async (deviceName) => {
        if (!window.workingApiUrl) return;

        // Add device to refreshing set
        setRefreshingDevices(prev => new Set([...prev, deviceName]));

        try {
            const response = await apiCall(window.workingApiUrl, `/device-status/${deviceName}`);
            setDeviceStatuses(prev => ({
                ...prev,
                [deviceName]: {
                    status: response.overallStatus,
                    ips: response.ips,
                    mac: response.mac
                }
            }));
        } catch (err) {
            // Handle refresh error silently or show a message
        } finally {
            // Remove device from refreshing set
            setRefreshingDevices(prev => {
                const newSet = new Set(prev);
                newSet.delete(deviceName);
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

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
            {/* Header Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Network Devices
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    Monitor and manage devices on your network
                </Typography>

                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#f8fafc' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                {devices.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Total Devices
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
            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading devices...
                    </Typography>
                </Box>
            ) : devices.length > 0 ? (
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
                                                    {getDeviceTypeIcon(device)}
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
                                        </Box>

                                        {/* Device Info */}
                                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                            {device}
                                        </Typography>

                                        <Chip
                                            label={isOnline ? 'Online' : 'Offline'}
                                            color={isOnline ? 'success' : 'error'}
                                            size="small"
                                            sx={{ mb: 2 }}
                                        />

                                        {/* Device Details */}
                                        <Stack spacing={1} sx={{ mb: 3 }}>
                                            {deviceInfo.mac && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">MAC:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{deviceInfo.mac}</Typography>
                                                </Box>
                                            )}
                                        </Stack>

                                        {/* Network Interfaces */}
                                        {deviceInfo.ips && deviceInfo.ips.length > 0 && (
                                            <Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                    Network Interfaces:
                                                </Typography>
                                                <Stack spacing={1}>
                                                    {deviceInfo.ips.map((ipObj, index) => (
                                                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                {ipObj.ip}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Chip label={ipObj.type} size="small" variant="outlined" />
                                                                {ipObj.status === 'online' ? (
                                                                    <OnlineIcon sx={{ color: 'success.main', fontSize: 16 }} />
                                                                ) : (
                                                                    <OfflineIcon sx={{ color: 'error.main', fontSize: 16 }} />
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        )}
                                    </CardContent>

                                    {/* Actions */}
                                    <Divider />
                                    <Box sx={{ p: 2 }}>
                                        <Button
                                            fullWidth
                                            variant={isOnline ? "outlined" : "contained"}
                                            startIcon={<PowerIcon />}
                                            onClick={() => handleWakeOnLan(device)}
                                            disabled={isOnline}
                                            color="primary"
                                        >
                                            {isOnline ? 'Already Online' : 'Wake Device'}
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
                        No Devices Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No devices are configured or failed to load devices from the server.
                    </Typography>
                </Paper>
            )}

            {/* Info Section */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.50' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About Device Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    This page shows all configured network devices. You can monitor their status,
                    view network interface information, and wake up devices using Wake-on-LAN.
                    Device status is automatically refreshed every 30 seconds.
                </Typography>
            </Paper>
        </Container>
    );
};

export default Devices;
