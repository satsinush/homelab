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
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Select,
    MenuItem,
    FormControl
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
    FilterList as FilterIcon,
    ViewModule as CardViewIcon,
    ViewList as TableViewIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const Devices = () => {
    const [allDevices, setAllDevices] = useState([]);
    const [savedDevices, setSavedDevices] = useState([]);
    const [discoveredDevices, setDiscoveredDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const { showSuccess, showError, showDeleteConfirmation } = useNotification();

    // Device management states
    const [deviceDialog, setDeviceDialog] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [deviceForm, setDeviceForm] = useState({ name: '', mac: '', description: '' });
    const [savingDiscoveredDevice, setSavingDiscoveredDevice] = useState(null);

    // Filter and search states
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem('devicesViewMode') || 'cards';
    }); // 'cards' or 'table'

    // Table filter states
    const [nameFilter, setNameFilter] = useState('');
    const [macFilter, setMacFilter] = useState('');
    const [ipFilter, setIpFilter] = useState('');
    const [vendorFilter, setVendorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleWakeOnLan = async (device) => {
        // Only saved devices can receive WOL packets
        if (!device.isSaved) {
            showError('Only saved devices can receive Wake-on-LAN packets. Please save this device first.');
            return;
        }

        const deviceName = device.friendlyName || device.mac;

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
        setRefreshingAll(true);

        try {
            // Trigger a new arp-scan for all devices
            const response = await tryApiCall('/devices/scan', {
                method: 'POST'
            });

            // Update device lists from scan response
            setAllDevices(response.data.allDevices || []);
            setSavedDevices(response.data.savedDevices || []);
            setDiscoveredDevices(response.data.discoveredDevices || []);

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
        setSavingDiscoveredDevice(null);
        setDeviceForm({ name: '', mac: '', description: '' });
        setDeviceDialog(true);
    };

    const handleSaveDiscoveredDevice = (device) => {
        setSavingDiscoveredDevice(device);
        setEditingDevice(null);
        setDeviceForm({
            name: device.vendor || 'Unknown Device',
            mac: device.mac.replace(/-/g, ':'),
            description: `Device found at ${device.ip}`
        });
        setDeviceDialog(true);
    };

    const handleEditDevice = (device) => {
        setEditingDevice(device);
        setSavingDiscoveredDevice(null);
        setDeviceForm({
            name: device.friendlyName || '',
            mac: device.mac.replace(/-/g, ':') || '',
            description: device.description || ''
        });
        setDeviceDialog(true);
    };

    const handleDeleteDevice = async (deviceId) => {
        const device = savedDevices.find(d => d._id === deviceId);
        const deviceName = device?.friendlyName || 'this device';

        showDeleteConfirmation(deviceName, async () => {
            try {
                await tryApiCall(`/devices/${deviceId}`, {
                    method: 'DELETE'
                });

                // Immediately remove device from local state for instant UI feedback
                setSavedDevices(prevDevices => prevDevices.filter(d => d._id !== deviceId));
                setAllDevices(prevDevices => prevDevices.map(d =>
                    d._id === deviceId ? { ...d, isSaved: false, _id: null, friendlyName: null, description: null } : d
                ));

                showSuccess('Device deleted successfully');

                // Refresh device list in background to ensure consistency
                await fetchDevices();
            } catch (err) {
                showError(`Failed to delete device: ${err.message}`);
            }
        });
    };

    const handleSaveDevice = async () => {
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
                await tryApiCall(`/devices/${editingDevice._id}`, {
                    method: 'PUT',
                    data: deviceData
                });

                // Update local state immediately
                setSavedDevices(prevDevices =>
                    prevDevices.map(d =>
                        d._id === editingDevice._id
                            ? { ...d, friendlyName: deviceData.name, description: deviceData.description }
                            : d
                    )
                );
                setAllDevices(prevDevices =>
                    prevDevices.map(d =>
                        d._id === editingDevice._id
                            ? { ...d, friendlyName: deviceData.name, description: deviceData.description }
                            : d
                    )
                );

                showSuccess('Device updated successfully');
            } else {
                // Add new device (either manual or from discovered)
                const response = await tryApiCall('/devices', {
                    method: 'POST',
                    data: deviceData
                });

                const newDevice = response.data;

                // Update local state immediately
                setSavedDevices(prevDevices => [...prevDevices, newDevice]);

                // If this was a discovered device, remove it from discovered list and update allDevices
                if (savingDiscoveredDevice) {
                    setDiscoveredDevices(prevDevices =>
                        prevDevices.filter(d => d.mac !== deviceData.mac.replace(/:/g, '-'))
                    );
                    setAllDevices(prevDevices =>
                        prevDevices.map(d =>
                            d.mac === deviceData.mac.replace(/:/g, '-')
                                ? { ...d, isSaved: true, _id: newDevice._id, friendlyName: deviceData.name, description: deviceData.description }
                                : d
                        )
                    );
                } else {
                    // Manual add - add to allDevices as well
                    setAllDevices(prevDevices => [...prevDevices, { ...newDevice, isSaved: true }]);
                }

                showSuccess('Device saved successfully');
            }

            setDeviceDialog(false);
            setEditingDevice(null);
            setSavingDiscoveredDevice(null);
            setDeviceForm({ name: '', mac: '', description: '' });

        } catch (err) {
            showError(`Failed to save device: ${err.message}`);
        }
    };

    const fetchDevices = async () => {
        try {
            // Fetch all device data using simplified endpoint
            const response = await tryApiCall('/devices');

            setAllDevices(response.data.allDevices || []);
            setSavedDevices(response.data.savedDevices || []);
            setDiscoveredDevices(response.data.discoveredDevices || []);
            setLoading(false);

        } catch (err) {
            console.error('All API endpoints failed:', err);
            showError(`Failed to connect to API server: ${err.message}`);
            setLoading(false);

            // Set empty data for development
            setAllDevices([]);
            setSavedDevices([]);
            setDiscoveredDevices([]);
        }
    };

    const clearMessages = () => {
        // No longer needed with notification system
    };

    const clearTableFilters = () => {
        setNameFilter('');
        setMacFilter('');
        setIpFilter('');
        setVendorFilter('');
        setStatusFilter('');
        setTypeFilter('');
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
    const getFilteredDevices = (deviceList, isTableView = false) => {
        return deviceList.filter(device => {
            const deviceName = (device.friendlyName || device.vendor || 'Unknown').toLowerCase();
            const deviceMac = (device.mac || '').toLowerCase();
            const deviceIp = (device.ip || '').toLowerCase();
            const deviceVendor = (device.vendor || '').toLowerCase();
            const deviceStatus = (device.status || '').toLowerCase();
            const isOnline = device.status === 'online';

            // Card view filters
            if (!isTableView) {
                // Filter by status
                if (filterStatus === 'online' && !isOnline) return false;
                if (filterStatus === 'offline' && isOnline) return false;

                // Filter by search term
                if (searchTerm && !deviceName.includes(searchTerm.toLowerCase())) {
                    return false;
                }
            } else {
                // Table view filters
                if (nameFilter && !deviceName.includes(nameFilter.toLowerCase())) return false;
                if (macFilter && !deviceMac.includes(macFilter.toLowerCase())) return false;
                if (ipFilter && !deviceIp.includes(ipFilter.toLowerCase())) return false;
                if (vendorFilter && !deviceVendor.includes(vendorFilter.toLowerCase())) return false;
                if (statusFilter && !deviceStatus.includes(statusFilter.toLowerCase())) return false;

                // Type filter - check if device is saved or discovered
                if (typeFilter) {
                    const deviceType = device.isSaved ? 'saved' : 'discovered';
                    if (!deviceType.includes(typeFilter.toLowerCase())) return false;
                }
            }

            return true;
        });
    };

    const filteredSavedDevices = getFilteredDevices(savedDevices, viewMode === 'table');
    const filteredDiscoveredDevices = getFilteredDevices(discoveredDevices, viewMode === 'table');

    // Generate dynamic filter options
    const getUniqueValues = (devices, key) => {
        const values = devices
            .map(device => {
                if (key === 'status') return device.status;
                if (key === 'type') return device.isSaved ? 'saved' : 'discovered';
                return '';
            })
            .filter(value => value && value.trim() !== '')
            .map(value => value.toLowerCase());
        return [...new Set(values)].sort();
    };

    // Combine all devices for unified table
    const allDevicesForTable = [
        ...savedDevices.map(device => ({ ...device, isSaved: true })),
        ...discoveredDevices.map(device => ({ ...device, isSaved: false }))
    ];

    const statusOptions = getUniqueValues([...savedDevices, ...discoveredDevices], 'status');
    const typeOptions = getUniqueValues(allDevicesForTable, 'type');

    const filteredAllDevices = getFilteredDevices(allDevicesForTable, viewMode === 'table');

    // Table rendering helper
    const renderDevicesTable = () => (
        <TableContainer
            component={Paper}
            sx={{
                mb: 4,
                overflowX: 'auto'
            }}
        >
            <Table sx={{ minWidth: 650 }}>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>MAC Address</TableCell>
                        <TableCell>IP Address</TableCell>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="center">Actions</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>
                            <TextField
                                size="small"
                                placeholder="Filter name..."
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                placeholder="Filter MAC..."
                                value={macFilter}
                                onChange={(e) => setMacFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                placeholder="Filter IP..."
                                value={ipFilter}
                                onChange={(e) => setIpFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                placeholder="Filter vendor..."
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                        </TableCell>
                        <TableCell>
                            <FormControl size="small" fullWidth>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    displayEmpty
                                    variant="outlined"
                                >
                                    <MenuItem value="">All Status</MenuItem>
                                    {statusOptions.map(status => (
                                        <MenuItem key={status} value={status}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </TableCell>
                        <TableCell>
                            <FormControl size="small" fullWidth>
                                <Select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    displayEmpty
                                    variant="outlined"
                                >
                                    <MenuItem value="">All Types</MenuItem>
                                    {typeOptions.map(type => (
                                        <MenuItem key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </TableCell>
                        <TableCell align="center">
                            <Button
                                variant="outlined"
                                startIcon={<FilterIcon />}
                                onClick={clearTableFilters}
                                size="small"
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                Clear Filters
                            </Button>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredAllDevices.length > 0 ? (
                        filteredAllDevices.map(device => (
                            <TableRow key={device.isSaved ? device._id : device.mac} hover>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getDeviceTypeIcon(device.friendlyName || device.vendor)}
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {device.friendlyName || device.vendor || 'Unknown Device'}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                    {device.mac}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                    {device.ip || '-'}
                                </TableCell>
                                <TableCell>{device.vendor || '-'}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={device.status === 'online' || !device.isSaved ? 'Online' : 'Offline'}
                                        color={device.status === 'online' || !device.isSaved ? 'success' : 'error'}
                                        size="small"
                                        icon={device.status === 'online' || !device.isSaved ? <OnlineIcon /> : <OfflineIcon />}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={device.isSaved ? 'SAVED' : 'DISCOVERED'}
                                        color={device.isSaved ? 'primary' : 'warning'}
                                        size="small"
                                        variant={device.isSaved ? 'filled' : 'outlined'}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        {device.isSaved ? (
                                            <>
                                                <Tooltip title="Wake Device">
                                                    <IconButton
                                                        onClick={() => handleWakeOnLan(device)}
                                                        color="primary"
                                                        size="small"
                                                    >
                                                        <PowerIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit Device">
                                                    <IconButton
                                                        onClick={() => handleEditDevice(device)}
                                                        size="small"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Device">
                                                    <IconButton
                                                        onClick={() => handleDeleteDevice(device._id)}
                                                        color="error"
                                                        size="small"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        ) : (
                                            <Tooltip title="Save Device">
                                                <IconButton
                                                    onClick={() => handleSaveDiscoveredDevice(device)}
                                                    color="primary"
                                                    size="small"
                                                >
                                                    <AddIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                                <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, display: 'block', mx: 'auto' }} />
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    No Devices Found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {allDevicesForTable.length === 0
                                        ? 'No devices available. Try running a network scan or add devices manually.'
                                        : 'No devices match your current filters. Try adjusting your search criteria.'
                                    }
                                </Typography>
                            </TableCell>
                        </TableRow>)}
                </TableBody>
            </Table>
        </TableContainer>
    );

    if (loading) {
        return (<Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
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
        <Container
            maxWidth="xl"
            sx={{
                py: 4,
                px: { xs: 1, sm: 2, md: 3 }
            }}
        >
            {/* Header Section */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                    <Box>
                        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                            Network Devices
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            Monitor and wake up devices on your network
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(e, newView) => {
                                if (newView) {
                                    setViewMode(newView);
                                    localStorage.setItem('devicesViewMode', newView);
                                }
                            }}
                            size="small"
                        >
                            <ToggleButton value="cards">
                                <CardViewIcon />
                            </ToggleButton>
                            <ToggleButton value="table">
                                <TableViewIcon />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={handleAddDevice}
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
                        >
                            {refreshingAll ? 'Refreshing...' : 'Refresh All'}
                        </Button>
                    </Box>
                </Box>

                {/* Stats Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'action.selected' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                {allDevices.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Total Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {savedDevices.length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Saved Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {allDevices.filter(d => d.status === 'online').length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Online
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {discoveredDevices.length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Discovered
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Content */}
            <Box sx={{ mb: 4 }}>
                {viewMode === 'cards' ? (
                    <>
                        {/* Saved Devices Section */}
                        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
                            Saved Devices ({savedDevices.length})
                        </Typography>
                        {filteredSavedDevices.length > 0 ? (
                            <Grid container spacing={3} sx={{ mb: 8 }}>
                                {filteredSavedDevices.map(device => (
                                    <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={device._id}>
                                        <Card sx={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            border: '2px solid',
                                            borderColor: 'primary.main'
                                        }}>
                                            <CardContent sx={{ flexGrow: 1 }}>
                                                {/* Device Header */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                            {getDeviceTypeIcon(device.friendlyName)}
                                                            {device.status === 'online' ? (
                                                                <OnlineIcon sx={{ color: 'success.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                            ) : (
                                                                <OfflineIcon sx={{ color: 'error.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                            )}
                                                        </Box>
                                                    </Box>
                                                    <Chip label="SAVED" color="primary" size="small" />
                                                </Box>

                                                {/* Device Info */}
                                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                                    {device.friendlyName}
                                                </Typography>

                                                <Chip
                                                    label={device.status === 'online' ? 'Online' : 'Offline'}
                                                    color={device.status === 'online' ? 'success' : 'error'}
                                                    size="small"
                                                    sx={{ mb: 2 }}
                                                />

                                                {/* Device Details */}
                                                <Stack spacing={1} sx={{ mb: 3 }}>
                                                    {device.ip && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">IP:</Typography>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{device.ip}</Typography>
                                                        </Box>
                                                    )}
                                                    {device.mac && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">MAC:</Typography>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{device.mac}</Typography>
                                                        </Box>
                                                    )}
                                                    {device.vendor && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">Vendor:</Typography>
                                                            <Typography variant="body2">{device.vendor}</Typography>
                                                        </Box>
                                                    )}
                                                    {device.description && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">Description:</Typography>
                                                            <Typography variant="body2">{device.description}</Typography>
                                                        </Box>
                                                    )}
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
                                                            onClick={() => handleEditDevice(device)}
                                                            size="small"
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            fullWidth
                                                            variant="outlined"
                                                            startIcon={<DeleteIcon />}
                                                            onClick={() => handleDeleteDevice(device._id)}
                                                            color="error"
                                                            size="small"
                                                        >
                                                            Delete
                                                        </Button>
                                                    </Stack>                                                </Stack>
                                            </Box>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Paper sx={{ p: 4, mb: 8, textAlign: 'center', bgcolor: 'action.selected' }}>
                                <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    No Saved Devices
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Save discovered devices to give them names and enable Wake-on-LAN.
                                </Typography>
                            </Paper>
                        )}

                        {/* Discovered Devices Section */}
                        <Typography variant="h4" sx={{ mb: 3, mt: 6, fontWeight: 600 }}>
                            Discovered Devices ({discoveredDevices.length})
                        </Typography>
                        {filteredDiscoveredDevices.length > 0 ? (
                            <Grid container spacing={3}>
                                {filteredDiscoveredDevices.map(device => (
                                    <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={device.mac}>
                                        <Card sx={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}>
                                            <CardContent sx={{ flexGrow: 1 }}>
                                                {/* Device Header */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                            {getDeviceTypeIcon(device.vendor)}
                                                            <OnlineIcon sx={{ color: 'success.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                        </Box>
                                                    </Box>
                                                    <Chip label="DISCOVERED" color="warning" size="small" />
                                                </Box>

                                                {/* Device Info */}
                                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                                    {device.vendor || 'Unknown Device'}
                                                </Typography>

                                                <Chip
                                                    label="Online"
                                                    color="success"
                                                    size="small"
                                                    sx={{ mb: 2 }}
                                                />

                                                {/* Device Details */}
                                                <Stack spacing={1} sx={{ mb: 3 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">IP:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{device.ip}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">MAC:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{device.mac}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Vendor:</Typography>
                                                        <Typography variant="body2">{device.vendor}</Typography>
                                                    </Box>
                                                </Stack>
                                            </CardContent>

                                            {/* Actions */}
                                            <Divider />
                                            <Box sx={{ p: 2 }}>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => handleSaveDiscoveredDevice(device)}
                                                    color="primary"
                                                >
                                                    Save Device
                                                </Button>                                            </Box>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.selected' }}>
                                <RouterIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    No Discovered Devices
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Run a network scan to discover devices on your network.
                                </Typography>
                            </Paper>
                        )}
                    </>
                ) : (
                    <Box>
                        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
                            All Devices ({allDevicesForTable.length})
                        </Typography>
                        {renderDevicesTable()}
                    </Box>
                )}
            </Box>

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
            <Dialog open={deviceDialog} onClose={() => {
                setDeviceDialog(false);
                setEditingDevice(null);
                setSavingDiscoveredDevice(null);
                setDeviceForm({ name: '', mac: '', description: '' });
            }} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingDevice ? 'Edit Saved Device' :
                        (savingDiscoveredDevice ? 'Save Discovered Device' : 'Add New Device')}
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
                    <Button onClick={() => {
                        setDeviceDialog(false);
                        setEditingDevice(null);
                        setSavingDiscoveredDevice(null);
                        setDeviceForm({ name: '', mac: '', description: '' });
                    }}>Cancel</Button>
                    <Button onClick={handleSaveDevice} variant="contained">
                        {editingDevice ? 'Update' : 'Add'} Device
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Devices;
