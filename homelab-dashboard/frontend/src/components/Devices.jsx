// src/components/Devices.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    FormControl,
    FormControlLabel,
    Checkbox
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
    Clear as ClearIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    ViewModule as CardViewIcon,
    ViewList as TableViewIcon,
    Sort as SortIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { formatDevicesForDisplay, formatMacForDisplay, normalizeMacForApi } from '../utils/formatters';

// Separate memoized component for the device dialog to prevent re-renders
const DeviceDialog = React.memo(({
    open,
    onClose,
    editingDevice,
    initialDeviceForm,
    onSave
}) => {
    // Internal form state - completely isolated from parent component
    const [deviceForm, setDeviceForm] = useState({ name: '', mac: '', description: '' });

    // Update internal form when dialog opens with new data
    useEffect(() => {
        if (open && initialDeviceForm) {
            setDeviceForm(initialDeviceForm);
        } else if (!open) {
            // Reset form when dialog closes
            setDeviceForm({ name: '', mac: '', description: '' });
        }
    }, [open, initialDeviceForm]);

    // Internal form change handler - doesn't affect parent component
    const handleFormChange = useCallback((field, value) => {
        setDeviceForm(prev => ({ ...prev, [field]: value }));
    }, []);

    // Handle save - pass the form data to parent
    const handleSave = useCallback(() => {
        onSave(deviceForm);
    }, [onSave, deviceForm]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {editingDevice ? 'Edit Device' : 'Add New Device'}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        label="Device Name"
                        value={deviceForm.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        fullWidth
                        required
                        placeholder="e.g., Desktop PC"
                    />
                    <TextField
                        label="MAC Address"
                        value={deviceForm.mac}
                        onChange={(e) => handleFormChange('mac', e.target.value)}
                        fullWidth
                        required
                        placeholder="e.g., AA:BB:CC:DD:EE:FF"
                        disabled={editingDevice}
                    />
                    <TextField
                        label="Description"
                        value={deviceForm.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="e.g., Main Desktop Computer"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">
                    {editingDevice ? 'Save' : 'Add Favorite'}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const { showSuccess, showError, showDeleteConfirmation, showConfirmDialog } = useNotification();

    // Device management states
    const [deviceDialog, setDeviceDialog] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [initialDeviceForm, setInitialDeviceForm] = useState({ name: '', mac: '', description: '' });

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

    // Sorting states
    const [sortBy, setSortBy] = useState('status');
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleWakeOnLan = async (device) => {
        try {
            const result = await tryApiCall('/wol', {
                method: 'POST',
                data: { device: device },
                timeout: 10000
            });
            showSuccess(`Wake-on-LAN sent successfully!`);
        } catch (err) {
            // Use the specific error message from the API
            showError(err.message || 'Failed to send Wake-on-LAN!');
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
            setDevices(formatDevicesForDisplay(response.data.devices || []));
            showSuccess('Device status refreshed successfully');
        } catch (err) {
            showError(`Failed to refresh device status: ${err.message}`);
        } finally {
            setRefreshingAll(false);
        }
    };

    const handleClearCache = async () => {
        const discoveredDevices = devices.filter(device => !device.isFavorite);
        const discoveredCount = discoveredDevices.length;

        showConfirmDialog({
            title: `Clear ${discoveredCount} discovered devices and rescan`,
            message: `Are you sure you want to clear ${discoveredCount} discovered devices and perform a fresh scan? Your favorite devices will not be affected.`,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            confirmColor: 'error',
            onConfirm: async () => {
                setClearingCache(true);

                try {
                    // Clear the discovered device cache and perform fresh scan
                    const response = await tryApiCall('/devices/clear-cache', {
                        method: 'POST'
                    });

                    // Update device lists from scan response
                    setDevices(formatDevicesForDisplay(response.data.devices || []));

                    showSuccess(`Cleared ${response.data.deletedCount || discoveredCount} discovered devices and completed fresh scan`);
                } catch (err) {
                    showError(`Failed to clear cache and rescan: ${err.message}`);
                } finally {
                    setClearingCache(false);
                }
            }
        });
    };

    // Memoized dialog close handler
    const handleDialogClose = useCallback(() => {
        setDeviceDialog(false);
        setEditingDevice(null);
        setInitialDeviceForm({ name: '', mac: '', description: '', isFavorite: false });
    }, []);

    // Device management functions
    const handleAddDevice = () => {
        setEditingDevice(null);
        setInitialDeviceForm({ name: '', mac: '', description: '' });
        setDeviceDialog(true);
    };

    const handleEditDevice = (device) => {
        // Only allow editing favorite devices
        if (!device.isFavorite) {
            showError('Only favorite devices can be edited');
            return;
        }

        setEditingDevice(device);
        setInitialDeviceForm({
            name: device.name || '',
            mac: formatMacForDisplay(device.macNormalized || device.mac) || '',
            description: device.description || ''
        });
        setDeviceDialog(true);
    };

    const handleToggleFavorite = async (device) => {
        try {
            const response = await tryApiCall(`/devices/${encodeURIComponent(device.macNormalized || device.mac)}/favorite`, {
                method: 'POST'
            });

            const updatedDevice = formatDevicesForDisplay([response.data.device])[0];
            const message = response.data.message;

            // Update local state immediately
            setDevices(prevDevices =>
                prevDevices.map(d =>
                    (d.macNormalized || d.mac) === (device.macNormalized || device.mac) ? updatedDevice : d
                )
            );

            showSuccess(message);
        } catch (err) {
            showError(`Failed to toggle favorite: ${err.message}`);
        }
    };

    const handleSaveDevice = async (deviceForm) => {
        if (!deviceForm.name.trim() || !deviceForm.mac.trim()) {
            showError('Name and MAC address are required');
            return;
        }

        // Normalize MAC address for comparison (convert to lowercase and handle both : and - formats)
        const normalizedInputMac = normalizeMacForApi(deviceForm.mac.trim());

        // Check for existing MAC address (only when adding new device, not editing)
        if (!editingDevice) {
            const existingDevice = devices.find(device => {
                if (!device.mac && !device.macNormalized) return false;
                const existingMac = normalizeMacForApi(device.macNormalized || device.mac);
                return existingMac === normalizedInputMac;
            });

            if (existingDevice) {
                const deviceName = existingDevice.name || existingDevice.vendor || 'Unknown Device';
                showError(`A device with MAC address ${formatMacForDisplay(normalizedInputMac)} already exists: ${deviceName}`);
                return;
            }
        }

        try {
            const deviceData = {
                name: deviceForm.name.trim(),
                mac: normalizeMacForApi(deviceForm.mac.trim()),
                description: deviceForm.description.trim()
            };

            if (editingDevice) {
                // Update existing device - use MAC as identifier
                const originalMac = editingDevice.macNormalized || normalizeMacForApi(editingDevice.mac);
                const response = await tryApiCall(`/devices/${encodeURIComponent(originalMac)}`, {
                    method: 'PUT',
                    data: deviceData
                });

                // Get the updated device from server response
                const updatedDevice = formatDevicesForDisplay([response.data.device])[0];

                // Update local state immediately with server response data
                setDevices(prevDevices =>
                    prevDevices.map(d =>
                        (d.macNormalized || normalizeMacForApi(d.mac)) === originalMac
                            ? { ...d, ...updatedDevice }
                            : d
                    )
                );

                showSuccess('Favorite device updated successfully');
            } else {
                // Add new device - use POST
                const response = await tryApiCall('/devices', {
                    method: 'POST',
                    data: deviceData
                });

                const newDevice = formatDevicesForDisplay([response.data.device])[0];

                // Add to devices list
                setDevices(prevDevices => [...prevDevices, newDevice]);

                showSuccess('Favorite device added successfully');
            }

            setDeviceDialog(false);
            setEditingDevice(null);
            setInitialDeviceForm({ name: '', mac: '', description: '' });

        } catch (err) {
            showError(`Failed to save device: ${err.message}`);
        }
    };

    const fetchDevices = async () => {
        try {
            // Fetch all device data using simplified endpoint
            const response = await tryApiCall('/devices');

            setDevices(formatDevicesForDisplay(response.data.devices || []));
            setLoading(false);
        } catch (err) {
            console.error('All API endpoints failed:', err);
            showError(`Failed to connect to API server: ${err.message}`);
            setLoading(false);

            // Set empty data for development
            setDevices([]);
        }
    };

    const clearTableFilters = () => {
        setNameFilter('');
        setMacFilter('');
        setIpFilter('');
        setVendorFilter('');
        setStatusFilter('');
        setFilterStatus('all');
        setSearchTerm('');
        setSortBy('name');
        setSortOrder('asc');
    };

    const getDeviceTypeIcon = (deviceName) => {
        if (!deviceName) return <ComputerIcon />; // Default for undefined/null/empty names

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

    // Memoized filter and sort function to prevent recalculation on every render
    const getFilteredDevices = useCallback((deviceList) => {
        const filtered = deviceList.filter(device => {
            const deviceName = (device.name || device.vendor || 'Unknown').toLowerCase();
            const deviceMac = normalizeMacForApi(device.macNormalized || device.mac || '');
            const deviceIp = (device.ip || '').toLowerCase();
            const deviceVendor = (device.vendor || '').toLowerCase();
            const deviceStatus = (device.status || '').toLowerCase();

            // Apply all filters
            if (nameFilter && !deviceName.includes(nameFilter.toLowerCase())) return false;
            if (macFilter && !deviceMac.includes(normalizeMacForApi(macFilter))) return false;
            if (ipFilter && !deviceIp.replace('.', '').includes(ipFilter.replace('.', '').toLowerCase())) return false;
            if (vendorFilter && !deviceVendor.includes(vendorFilter.toLowerCase())) return false;
            if (statusFilter && !deviceStatus.includes(statusFilter.toLowerCase())) return false;

            return true;
        });

        // Sort the filtered results - always show favorites first
        return filtered.sort((a, b) => {
            // First, sort by favorite status (favorites always on top)
            if (a.isFavorite !== b.isFavorite) {
                return b.isFavorite ? 1 : -1;
            }

            // If both are favorites or both are discovered, sort by the selected criteria
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = (a.name || a.vendor || 'Unknown').toLowerCase();
                    bValue = (b.name || b.vendor || 'Unknown').toLowerCase();
                    break;
                case 'mac':
                    aValue = (a.mac || '').toLowerCase();
                    bValue = (b.mac || '').toLowerCase();
                    break;
                case 'ip':
                    aValue = (a.ip || '').toLowerCase();
                    bValue = (b.ip || '').toLowerCase();
                    break;
                case 'vendor':
                    aValue = (a.vendor || '').toLowerCase();
                    bValue = (b.vendor || '').toLowerCase();
                    break;
                case 'status':
                    aValue = (a.status || '').toLowerCase();
                    bValue = (b.status || '').toLowerCase();
                    break;
                case 'isFavorite':
                    // If sorting by favorite and both have same favorite status, sort by name
                    aValue = (a.name || a.vendor || 'Unknown').toLowerCase();
                    bValue = (b.name || b.vendor || 'Unknown').toLowerCase();
                    break;
                default:
                    aValue = (a.name || a.vendor || 'Unknown').toLowerCase();
                    bValue = (b.name || b.vendor || 'Unknown').toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });
    }, [nameFilter, macFilter, ipFilter, vendorFilter, statusFilter, sortBy, sortOrder]);

    // Memoized function to generate dynamic filter options
    const getUniqueValues = useCallback((devices, key) => {
        const values = devices
            .map(device => {
                if (key === 'status') return device.status;
                return '';
            })
            .filter(value => value && value.trim() !== '')
            .map(value => value.toLowerCase());
        return [...new Set(values)].sort();
    }, []);

    // Memoize expensive computations to prevent re-calculation on every render
    const statusOptions = useMemo(() => getUniqueValues(devices, 'status'), [devices]);

    const filteredAllDevices = useMemo(() => {
        return getFilteredDevices(devices);
    }, [devices, nameFilter, macFilter, ipFilter, vendorFilter, statusFilter, sortBy, sortOrder]);

    const renderCards = () => (
        <>
            {/* All Devices Section */}
            {filteredAllDevices.length > 0 ? (
                <Grid container spacing={3}>
                    {filteredAllDevices.map(device => (
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={device.macNormalized || device.mac}>
                            <Card sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                border: device.isFavorite ? '2px solid' : '1px solid',
                                borderColor: device.isFavorite ? 'primary.main' : 'divider'
                            }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                {getDeviceTypeIcon(device.name || device.vendor)}
                                                {/* {device.status === 'online' ? (
                                                    <OnlineIcon sx={{ color: 'success.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                ) : (
                                                    <OfflineIcon sx={{ color: 'error.main', fontSize: 16, position: 'absolute', top: -4, right: -4 }} />
                                                )} */}
                                            </Box>
                                            <Chip
                                                label={device.status === 'online' ? 'Online' : 'Offline'}
                                                color={device.status === 'online' ? 'success' : 'error'}
                                                size="small"
                                                sx={{ mb: 0 }}
                                                icon={device.status === 'online' ? <OnlineIcon /> : <OfflineIcon />}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip
                                                label={device.isFavorite ? "FAVORITE" : "DISCOVERED"}
                                                color={device.isFavorite ? "primary" : "default"}
                                                size="small"
                                                variant={device.isFavorite ? 'filled' : 'outlined'}
                                                icon={device.isFavorite ? <StarIcon /> : undefined}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() => handleToggleFavorite(device)}
                                                color={device.isFavorite ? "primary" : "default"}
                                            >
                                                {device.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                                            </IconButton>
                                        </Box>
                                    </Box>

                                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                        {device.name}
                                    </Typography>

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
                                        {device.isFavorite && (
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<EditIcon />}
                                                onClick={() => handleEditDevice(device)}
                                                size="small"
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Stack>
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.selected' }}>
                    <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        No Devices Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {devices.length === 0
                            ? 'No devices available. Try running a network scan or add devices manually.'
                            : 'No devices match your current filters. Try adjusting your search criteria.'
                        }
                    </Typography>
                </Paper>
            )}
        </>
    )

    // Table rendering helper
    const renderDevicesTable = () => (
        <TableContainer
            component={Paper}
            sx={{
                mb: 4,
                overflowX: 'auto',
            }}
        >
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>MAC Address</TableCell>
                        <TableCell>IP Address</TableCell>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredAllDevices.length > 0 ? (
                        filteredAllDevices.map(device => (
                            <TableRow key={device.macNormalized || device.mac} hover>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getDeviceTypeIcon(device.name || device.vendor)}
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {device.name || device.vendor || 'Unknown Device'}
                                        </Typography>
                                        {device.isFavorite && (
                                            <StarIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                                        )}
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
                                        label={device.status === 'online' ? 'Online' : 'Offline'}
                                        color={device.status === 'online' ? 'success' : 'error'}
                                        size="small"
                                        icon={device.status === 'online' ? <OnlineIcon /> : <OfflineIcon />}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        <Tooltip title="Toggle Favorite">
                                            <IconButton
                                                onClick={() => handleToggleFavorite(device)}
                                                color={device.isFavorite ? "primary" : "default"}
                                                size="small"
                                            >
                                                {device.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={"Wake Device"}>
                                            <IconButton
                                                onClick={() => handleWakeOnLan(device)}
                                                color="primary"
                                                size="small"
                                            >
                                                <PowerIcon />
                                            </IconButton>
                                        </Tooltip>
                                        {device.isFavorite && (
                                            <Tooltip title="Edit Device">
                                                <IconButton
                                                    onClick={() => handleEditDevice(device)}
                                                    size="small"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                                <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, display: 'block', mx: 'auto' }} />
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    No Devices Found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {devices.length === 0
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
                            Add Favorite
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
                            disabled={refreshingAll || clearingCache}
                        >
                            {refreshingAll ? 'Rescanning...' : 'Rescan'}
                        </Button>
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<ClearIcon sx={{
                                animation: clearingCache ? 'spin 1s linear infinite' : 'none',
                                '@keyframes spin': {
                                    '0%': { transform: 'rotate(0deg)' },
                                    '100%': { transform: 'rotate(360deg)' }
                                }
                            }} />}
                            onClick={handleClearCache}
                            disabled={refreshingAll || clearingCache}
                        >
                            {clearingCache ? 'Clearing...' : 'Clear Devices & Rescan'}
                        </Button>
                    </Box>
                </Box>

                {/* Stats Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'action.selected' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                {devices.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Total Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {devices.filter(device => device.isFavorite).length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Favorite Devices
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {devices.filter(d => d.status === 'online').length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Online
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {devices.filter(device => !device.isFavorite).length}
                            </Typography>
                            <Typography variant="body2" color="inherit" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Discovered
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Filters Section - Always Visible */}
            <Paper sx={{ mb: 4, p: 2 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter & Sort Devices
                </Typography>
                <Grid container spacing={2}>
                    {/* Filter Controls with Sort Buttons */}
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size="small"
                                label="Name"
                                placeholder="Filter by name..."
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (sortBy === 'name') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('name');
                                        setSortOrder('asc');
                                    }
                                }}
                                sx={{
                                    color: sortBy === 'name' ? 'primary.main' : 'text.secondary',
                                    bgcolor: sortBy === 'name' ? 'primary.50' : 'transparent'
                                }}
                            >
                                {sortBy === 'name' && sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                            </IconButton>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size="small"
                                label="MAC Address"
                                placeholder="Filter by MAC..."
                                value={macFilter}
                                onChange={(e) => setMacFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (sortBy === 'mac') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('mac');
                                        setSortOrder('asc');
                                    }
                                }}
                                sx={{
                                    color: sortBy === 'mac' ? 'primary.main' : 'text.secondary',
                                    bgcolor: sortBy === 'mac' ? 'primary.50' : 'transparent'
                                }}
                            >
                                {sortBy === 'mac' && sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                            </IconButton>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size="small"
                                label="IP Address"
                                placeholder="Filter by IP..."
                                value={ipFilter}
                                onChange={(e) => setIpFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (sortBy === 'ip') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('ip');
                                        setSortOrder('asc');
                                    }
                                }}
                                sx={{
                                    color: sortBy === 'ip' ? 'primary.main' : 'text.secondary',
                                    bgcolor: sortBy === 'ip' ? 'primary.50' : 'transparent'
                                }}
                            >
                                {sortBy === 'ip' && sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                            </IconButton>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size="small"
                                label="Vendor"
                                placeholder="Filter by vendor..."
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                fullWidth
                                variant="outlined"
                            />
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (sortBy === 'vendor') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('vendor');
                                        setSortOrder('asc');
                                    }
                                }}
                                sx={{
                                    color: sortBy === 'vendor' ? 'primary.main' : 'text.secondary',
                                    bgcolor: sortBy === 'vendor' ? 'primary.50' : 'transparent'
                                }}
                            >
                                {sortBy === 'vendor' && sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                            </IconButton>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (sortBy === 'status') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('status');
                                        setSortOrder('asc');
                                    }
                                }}
                                sx={{
                                    color: sortBy === 'status' ? 'primary.main' : 'text.secondary',
                                    bgcolor: sortBy === 'status' ? 'primary.50' : 'transparent'
                                }}
                            >
                                {sortBy === 'status' && sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                            </IconButton>
                        </Box>
                    </Grid>

                    {/* Clear All Button */}
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            variant="outlined"
                            startIcon={<FilterIcon />}
                            onClick={clearTableFilters}
                            size="small"
                            fullWidth
                            sx={{ height: '40px' }}
                        >
                            Clear All
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Content */}
            <Box sx={{ mb: 4 }}>
                {viewMode === 'cards' ? (
                    renderCards()
                ) : (
                    renderDevicesTable()
                )}
            </Box>

            {/* Device Management Dialog */}
            <DeviceDialog
                open={deviceDialog}
                onClose={handleDialogClose}
                editingDevice={editingDevice}
                initialDeviceForm={initialDeviceForm}
                onSave={handleSaveDevice}
            />
        </Container>
    );
};

export default Devices;
