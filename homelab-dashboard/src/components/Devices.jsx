// src/components/Devices.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    Chip,
    CircularProgress,
    Container,
    Paper,
    Divider,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Grid,
    ToggleButton,
    ToggleButtonGroup,
    InputAdornment
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
    Cancel as OfflineIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { tryApiCall, apiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [deviceStatuses, setDeviceStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const { showSuccess, showError } = useNotification();

    // Device management states
    const [deviceDialog, setDeviceDialog] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [deviceForm, setDeviceForm] = useState({ name: '', mac: '', description: '' });

    // Filter and search states
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDevicesAndStatus();
    }, []);

    const handleWakeOnLan = async (deviceKey) => {
        // Get device info to find the friendly name for WOL
        const deviceInfo = deviceStatuses[deviceKey];
        const deviceName = deviceInfo?.friendlyName || deviceKey;

        try {
            const result = await tryApiCall('/wol', {
                method: 'POST',
                data: { device: deviceName },
                timeout: 10000
            });
            showSuccess(`Wake-on-LAN packet sent to ${deviceName} successfully!`);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
            showError(`Failed to send WoL packet to ${deviceName}: ${errorMsg}`);
        }
    };

    const handleRefreshAll = async () => {
        if (!window.workingApiUrl) return;

        setRefreshingAll(true);

        try {
            // Trigger a new arp-scan for all devices
            await apiCall(window.workingApiUrl, '/devices/scan', {
                method: 'POST'
            });

            // Fetch updated device statuses
            const response = await apiCall(window.workingApiUrl, '/devices/status');
            const statusMap = {};
            response.devices.forEach(device => {
                const deviceKey = device.deviceKey || device.mac || device.ip;
                statusMap[deviceKey] = {
                    _id: device._id,
                    status: device.status,
                    ip: device.ip,
                    mac: device.mac,
                    vendor: device.vendor,
                    networkName: device.networkName,
                    wolEnabled: device.wolEnabled,
                    friendlyName: device.friendlyName
                };
            });
            setDeviceStatuses(statusMap);
            showSuccess('Device status refreshed successfully');
        } catch (err) {
            showError(`Failed to refresh device status: ${err.message}`);
        } finally {
            setRefreshingAll(false);
        }
    };

    // Device management functions
    const handleAddDevice = () => {
        setEditingDevice(null);
        setDeviceForm({ name: '', mac: '', description: '' });
        setDeviceDialog(true);
    };

    const handleEditDevice = (device) => {
        setEditingDevice(device);
        setDeviceForm({
            name: device.friendlyName || '',
            mac: device.mac || '',
            description: device.description || ''
        });
        setDeviceDialog(true);
    };

    const handleDeleteDevice = async (deviceId) => {
        if (!window.workingApiUrl) return;

        if (!confirm('Are you sure you want to delete this device?')) return;

        try {
            await apiCall(window.workingApiUrl, `/devices/wol/${deviceId}`, {
                method: 'DELETE'
            });

            // Immediately remove device from local state for instant UI feedback
            setDevices(prevDevices => prevDevices.filter(device => {
                const deviceInfo = deviceStatuses[device];
                return deviceInfo?._id !== deviceId;
            }));

            // Also remove from device statuses
            setDeviceStatuses(prevStatuses => {
                const newStatuses = { ...prevStatuses };
                Object.keys(newStatuses).forEach(key => {
                    if (newStatuses[key]._id === deviceId) {
                        delete newStatuses[key];
                    }
                });
                return newStatuses;
            });

            showSuccess('Device deleted successfully');

            // Refresh device list in background to ensure consistency
            await fetchDevicesAndStatus();
        } catch (err) {
            showError(`Failed to delete device: ${err.message}`);
        }
    };

    const handleSaveDevice = async () => {
        if (!window.workingApiUrl) return;

        if (!deviceForm.name.trim() || !deviceForm.mac.trim()) {
            showError('Name and MAC address are required');
            return;
        }

        try {
            const deviceData = {
                name: deviceForm.name.trim(),
                mac: deviceForm.mac.trim(),
                description: deviceForm.description.trim()
            };

            if (editingDevice) {
                // Update existing device
                const response = await apiCall(window.workingApiUrl, `/devices/wol/${editingDevice._id}`, {
                    method: 'PUT',
                    data: deviceData
                });

                // Immediately update device in local state
                const deviceKey = editingDevice.mac || editingDevice.deviceKey;
                setDeviceStatuses(prevStatuses => ({
                    ...prevStatuses,
                    [deviceKey]: {
                        ...prevStatuses[deviceKey],
                        friendlyName: deviceData.name,
                        description: deviceData.description,
                        mac: deviceData.mac
                    }
                }));

                showSuccess('Device updated successfully');
            } else {
                // Add new device
                const response = await apiCall(window.workingApiUrl, '/devices/wol', {
                    method: 'POST',
                    data: deviceData
                });

                // Immediately add new device to local state for instant UI feedback
                const normalizedMac = deviceData.mac.toUpperCase().replace(/:/g, '-');
                const newDevice = {
                    _id: response.device._id || Date.now(), // Use response ID or fallback
                    status: 'offline', // Default to offline until next scan
                    ip: null,
                    mac: normalizedMac,
                    vendor: 'Unknown',
                    networkName: 'LAN',
                    wolEnabled: true,
                    friendlyName: deviceData.name,
                    description: deviceData.description,
                    deviceKey: normalizedMac
                };

                // Add to devices list
                setDevices(prevDevices => [...prevDevices, normalizedMac]);

                // Add to device statuses
                setDeviceStatuses(prevStatuses => ({
                    ...prevStatuses,
                    [normalizedMac]: newDevice
                }));

                showSuccess('Device added successfully');
            }

            setDeviceDialog(false);

            // Refresh device list in background to ensure consistency
            await fetchDevicesAndStatus();
        } catch (err) {
            showError(`Failed to save device: ${err.message}`);
        }
    };

    const fetchDevicesAndStatus = async () => {
        try {
            // Fetch device statuses
            const statusResult = await tryApiCall('/devices/status');

            // Extract device keys for the devices list
            const deviceKeys = statusResult.data.devices.map(device => device.deviceKey || device.mac || device.ip);
            setDevices(deviceKeys);

            // Map device statuses using deviceKey as key
            const statusMap = {};
            statusResult.data.devices.forEach(device => {
                const deviceKey = device.deviceKey || device.mac || device.ip;
                statusMap[deviceKey] = {
                    _id: device._id,
                    status: device.status,
                    ip: device.ip,
                    mac: device.mac,
                    vendor: device.vendor,
                    networkName: device.networkName,
                    wolEnabled: device.wolEnabled,
                    friendlyName: device.friendlyName,
                    description: device.description
                };
            });
            setDeviceStatuses(statusMap);
            setLoading(false);

            // Store working API URL for future requests
            window.workingApiUrl = statusResult.baseUrl;

        } catch (err) {
            console.error('All API endpoints failed:', err);
            showError(`Failed to connect to API server: ${err.message}`);
            setLoading(false);

            // Set dummy data for development
            setDevices([]);
            setDeviceStatuses({});
        }
    };

    const clearMessages = () => {
        // No longer needed with notification system
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

    // Filter devices based on status and search term
    const filteredDevices = devices.filter(device => {
        const deviceInfo = deviceStatuses[device] || {};
        const deviceName = (deviceInfo.friendlyName || device).toLowerCase();
        const isOnline = deviceInfo.status === 'online';

        // Filter by status
        if (filterStatus === 'online' && !isOnline) return false;
        if (filterStatus === 'offline' && isOnline) return false;

        // Filter by search term
        if (searchTerm && !deviceName.includes(searchTerm.toLowerCase())) {
            return false;
        }

        return true;
    });

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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                            Network Devices
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            Monitor and wake up devices on your network
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignSelf: 'flex-start' }}>
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={handleAddDevice}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            Add Device
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<RefreshIcon sx={{
                                animation: refreshingAll ? 'spin 1s linear infinite' : 'none',
                                '@keyframes spin': {
                                    '0%': { transform: 'rotate(0deg)' },
                                    '100%': { transform: 'rotate(360deg)' }
                                }
                            }} />}
                            onClick={handleRefreshAll}
                            disabled={refreshingAll}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {refreshingAll ? 'Refreshing...' : 'Refresh All'}
                        </Button>
                    </Box>
                </Box>

                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'action.selected' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                {devices.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                WOL Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {Object.values(deviceStatuses).filter(d => d.status === 'online').length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Online
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'error.light', color: 'error.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {Object.values(deviceStatuses).filter(d => d.status === 'offline').length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Offline
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Content */}
            {devices.length > 0 ? (
                <Grid container spacing={3}>
                    {filteredDevices.map(device => {
                        const deviceInfo = deviceStatuses[device] || {};
                        const isOnline = deviceInfo.status === 'online';

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
                                            {/*
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
                                            */}
                                        </Stack>
                                    </CardContent>

                                    {/* Actions */}
                                    <Divider />
                                    <Box sx={{ p: 2 }}>
                                        <Stack spacing={1}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<PowerIcon />}
                                                onClick={() => handleWakeOnLan(device)}
                                                color="primary"
                                            >
                                                Wake Device
                                            </Button>
                                            <Stack direction="row" spacing={1}>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => handleEditDevice(deviceInfo)}
                                                    size="small"
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => handleDeleteDevice(deviceInfo._id)}
                                                    color="error"
                                                    size="small"
                                                >
                                                    Delete
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'action.selected' }}>
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
            {/* <Paper sx={{ p: 3, mt: 4, bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About WOL Device Management
                </Typography>
                <Typography variant="body1" color="inherit">
                    This page shows all configured Wake-on-LAN devices. Each device is checked via ARP scan
                    to determine if it's currently online (has an IP address) or offline. You can wake up any
                    device using the Wake-on-LAN button. Use the "Refresh All" button to trigger a new ARP scan
                    and update the status of all devices.
                </Typography>
            </Paper> */}

            {/* Device Management Dialog */}
            <Dialog open={deviceDialog} onClose={() => setDeviceDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingDevice ? 'Edit WOL Device' : 'Add New WOL Device'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Device Name"
                            value={deviceForm.name}
                            onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                            fullWidth
                            required
                            placeholder="e.g., Desktop PC"
                        />
                        <TextField
                            label="MAC Address"
                            value={deviceForm.mac}
                            onChange={(e) => setDeviceForm({ ...deviceForm, mac: e.target.value })}
                            fullWidth
                            required
                            placeholder="e.g., AA:BB:CC:DD:EE:FF"
                        />
                        <TextField
                            label="Description"
                            value={deviceForm.description}
                            onChange={(e) => setDeviceForm({ ...deviceForm, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                            placeholder="e.g., Main Desktop Computer"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeviceDialog(false)}>Cancel</Button>
                    <Button onClick={handleSaveDevice} variant="contained">
                        {editingDevice ? 'Update' : 'Add'} Device
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Devices;
