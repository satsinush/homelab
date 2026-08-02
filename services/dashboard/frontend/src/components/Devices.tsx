// src/components/Devices.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Switch,
    InputAdornment,
    TablePagination
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
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    CastConnected as RustDeskIcon,
    Warning as WarningIcon,
    Devices as DevicesIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { formatDevicesForDisplay, formatMacForDisplay, normalizeMacForApi } from '../utils/formatters';
import {
    Device,
    DevicesResponse,
    DeviceResponse,
    ScanResponse,
    ClearCacheResponse,
    FavoriteResponse,
    RustdeskConfig,
    UserSettings,
} from '../types/api';

import { getErrorMessage } from '../utils/errors';

type DeviceViewMode = 'cards' | 'table';

interface DeviceListPrefs {
    deviceListView: string;
    showOfflineDevices: boolean;
    devicesPerPage: number;
    compactMode: boolean;
}

const DEFAULT_DEVICE_PREFS: DeviceListPrefs = {
    deviceListView: 'grid',
    showOfflineDevices: true,
    devicesPerPage: 25,
    compactMode: false,
};

function settingToViewMode(setting: string | undefined | null): DeviceViewMode {
    if (setting === 'list' || setting === 'table') return 'table';
    return 'cards';
}

function viewModeToSetting(mode: DeviceViewMode): 'grid' | 'list' {
    return mode === 'table' ? 'list' : 'grid';
}

function clampDevicesPerPage(n: number): number {
    if (!Number.isFinite(n) || n < 5) return 25;
    if (n > 100) return 100;
    return Math.floor(n);
}

interface DeviceDialogProps {
    open: boolean;
    onClose: () => void;
    editingDevice: Device | null;
    initialDeviceForm: Device;
    onSave: (deviceForm: Device) => void;
}

// Separate memoized component for the device dialog to prevent re-renders
const DeviceDialog = React.memo(({
    open,
    onClose,
    editingDevice,
    initialDeviceForm,
    onSave
}: DeviceDialogProps) => {
    // Internal form state - completely isolated from parent component
    const [deviceForm, setDeviceForm] = useState<Device>({ name: '', mac: '', description: '', rustdeskId: '' });

    // Update internal form when dialog opens with new data
    useEffect(() => {
        if (open && initialDeviceForm) {
            setDeviceForm(initialDeviceForm);
        } else if (!open) {
            // Reset form when dialog closes
            setDeviceForm({ name: '', mac: '', description: '', rustdeskId: '' });
        }
    }, [open, initialDeviceForm]);

    // Internal form change handler - doesn't affect parent component
    const handleFormChange = useCallback((field: keyof Device, value: unknown) => {
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
                        disabled={!!editingDevice}
                    />
                    <TextField
                        placeholder="e.g., Main Desktop Computer"
                    />
                    <TextField
                        label="RustDesk ID"
                        value={deviceForm.rustdeskId || ''}
                        onChange={(e) => handleFormChange('rustdeskId', e.target.value)}
                        fullWidth
                        placeholder="e.g., 123456789"
                        helperText="Required for one-click remote desktop access"
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
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const { showSuccess, showError, showConfirmDialog } = useNotification();

    // Device management states
    const [deviceDialog, setDeviceDialog] = useState(false);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [initialDeviceForm, setInitialDeviceForm] = useState<Device>({ name: '', mac: '', description: '', rustdeskId: '' });
    const [rustdeskConfig, setRustdeskConfig] = useState<RustdeskConfig>({ available: false, relayHost: '', publicKey: '' });

    // Filter and search states
    const [viewMode, setViewMode] = useState<DeviceViewMode>('cards');
    const [prefs, setPrefs] = useState<DeviceListPrefs>(DEFAULT_DEVICE_PREFS);
    const [page, setPage] = useState(0);

    // Table filter states
    const [nameFilter, setNameFilter] = useState('');
    const [macFilter, setMacFilter] = useState('');
    const [ipFilter, setIpFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Sorting states
    const [sortBy, setSortBy] = useState('status');
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

    const persistDevicePrefs = useCallback(async (patch: Partial<DeviceListPrefs>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            void (async () => {
                try {
                    const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
                    const current = res.data?.settings || {};
                    await tryApiCall('/user-settings', {
                        method: 'PUT',
                        data: {
                            ...current,
                            deviceListView: next.deviceListView,
                            showOfflineDevices: next.showOfflineDevices,
                            devicesPerPage: next.devicesPerPage,
                            compactMode: next.compactMode,
                        },
                    });
                } catch (err) {
                    console.error('Failed to save device list preferences:', err);
                }
            })();
            return next;
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
                if (cancelled) return;
                const s = res.data?.settings || {};
                const loaded: DeviceListPrefs = {
                    deviceListView:
                        typeof s.deviceListView === 'string' ? s.deviceListView : 'grid',
                    showOfflineDevices: s.showOfflineDevices !== false,
                    devicesPerPage: clampDevicesPerPage(Number(s.devicesPerPage) || 25),
                    compactMode: Boolean(s.compactMode),
                };
                setPrefs(loaded);
                setViewMode(settingToViewMode(loaded.deviceListView));
            } catch {
                /* keep defaults */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchRustdeskConfig = useCallback(async () => {
        try {
            const response = await tryApiCall<RustdeskConfig>('/system/rustdesk-config');
            if (response.data) {
                setRustdeskConfig(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch RustDesk config:', err);
        }
    }, []);

    const fetchDevices = useCallback(async () => {
        try {
            // Fetch all device data using simplified endpoint
            const response = await tryApiCall<DevicesResponse>('/devices');

            setDevices(formatDevicesForDisplay<Device>(response.data.devices || []));
            setLoading(false);
        } catch (err) {
            console.error('All API endpoints failed:', err);
            showError(`Failed to connect to API server: ${getErrorMessage(err)}`);
            setLoading(false);

            // Set empty data for development
            setDevices([]);
        }
    }, [showError]);

    useEffect(() => {
        fetchDevices();
        fetchRustdeskConfig();
    }, [fetchDevices, fetchRustdeskConfig]);

    const handleWakeOnLan = async (device: Device) => {
        try {
            await tryApiCall('/wol', {
                method: 'POST',
                data: { device: device },
                timeout: 10000
            });
            showSuccess(`Wake-on-LAN sent successfully!`);
        } catch (err) {
            showError(getErrorMessage(err) || 'Failed to send Wake-on-LAN!');
        }
    };

    const handleRustDeskConnect = (device: Device) => {
        if (!device.rustdeskId) return;

        if (!rustdeskConfig.available) {
            showError('Warning: RustDesk config is unavailable on the server. Launching client anyway...');
        }

        const url = `rustdesk://${device.rustdeskId.replace(/\s+/g, '')}`;
        
        showSuccess(`Launching RustDesk connection to ${device.name || device.rustdeskId}...`);
        window.location.href = url;
    };

    const handleRefreshAll = async () => {
        setRefreshingAll(true);

        try {
            const response = await tryApiCall<ScanResponse>('/devices/scan', {
                method: 'POST'
            });

            setDevices(formatDevicesForDisplay<Device>(response.data.devices || []));
            showSuccess('Device status refreshed successfully');
        } catch (err) {
            showError(`Failed to refresh device status: ${getErrorMessage(err)}`);
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
                    const response = await tryApiCall<ClearCacheResponse>('/devices/clear-cache', {
                        method: 'POST'
                    });

                    setDevices(formatDevicesForDisplay<Device>(response.data.devices || []));
                    showSuccess(`Cleared ${response.data.deletedCount || discoveredCount} discovered devices and completed fresh scan`);
                } catch (err) {
                    showError(`Failed to clear cache and rescan: ${getErrorMessage(err)}`);
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
        setInitialDeviceForm({ name: '', mac: '', description: '', rustdeskId: '', isFavorite: false });
    }, []);

    const handleAddDevice = () => {
        setEditingDevice(null);
        setInitialDeviceForm({ name: '', mac: '', description: '', rustdeskId: '' });
        setDeviceDialog(true);
    };

    const handleEditDevice = (device: Device) => {
        if (!device.isFavorite) {
            showError('Only favorite devices can be edited');
            return;
        }

        setEditingDevice(device);
        setInitialDeviceForm({
            name: device.name || '',
            mac: formatMacForDisplay(device.macNormalized || device.mac) || '',
            description: device.description || '',
            rustdeskId: device.rustdeskId || ''
        });
        setDeviceDialog(true);
    };

    const handleToggleFavorite = async (device: Device) => {
        try {
            const response = await tryApiCall<FavoriteResponse>(`/devices/${encodeURIComponent(device.macNormalized || device.mac)}/favorite`, {
                method: 'POST'
            });

            const updatedDevice = formatDevicesForDisplay([response.data.device])[0];
            const message = response.data.message;

            setDevices(prevDevices =>
                prevDevices.map(d =>
                    (d.macNormalized || d.mac) === (device.macNormalized || device.mac) ? updatedDevice : d
                )
            );

            showSuccess(message || 'Favorite updated');
        } catch (err) {
            showError(`Failed to toggle favorite: ${getErrorMessage(err)}`);
        }
    };

    const handleSaveDevice = async (deviceForm: Device) => {
        if (!deviceForm.name.trim() || !deviceForm.mac.trim()) {
            showError('Name and MAC address are required');
            return;
        }

        const normalizedInputMac = normalizeMacForApi(deviceForm.mac.trim());

        if (!editingDevice) {
            const existingDevice = devices.find(device => {
                if (!device.mac && !device.macNormalized) return false;
                const existingMac = normalizeMacForApi(device.macNormalized || device.mac);
                return existingMac === normalizedInputMac;
            });

            if (existingDevice) {
                const deviceName = existingDevice.name || 'Unknown Device';
                showError(`A device with MAC address ${formatMacForDisplay(normalizedInputMac)} already exists: ${deviceName}`);
                return;
            }
        }

        try {
            const deviceData = {
                name: deviceForm.name.trim(),
                mac: normalizeMacForApi(deviceForm.mac.trim()),
                description: deviceForm.description.trim(),
                rustdeskId: deviceForm.rustdeskId?.trim() || ''
            };

            if (editingDevice) {
                const originalMac = editingDevice.macNormalized || normalizeMacForApi(editingDevice.mac);
                const response = await tryApiCall<DeviceResponse>(`/devices/${encodeURIComponent(originalMac)}`, {
                    method: 'PUT',
                    data: deviceData
                });

                const updatedDevice = formatDevicesForDisplay([response.data.device])[0];

                setDevices(prevDevices =>
                    prevDevices.map(d =>
                        (d.macNormalized || normalizeMacForApi(d.mac)) === originalMac
                            ? { ...d, ...updatedDevice }
                            : d
                    )
                );

                showSuccess('Favorite device updated successfully');
            } else {
                const response = await tryApiCall<DeviceResponse>('/devices', {
                    method: 'POST',
                    data: deviceData
                });

                const newDevice = formatDevicesForDisplay([response.data.device])[0];
                setDevices(prevDevices => [...prevDevices, newDevice]);
                showSuccess('Favorite device added successfully');
            }

            setDeviceDialog(false);
            setEditingDevice(null);
            setInitialDeviceForm({ name: '', mac: '', description: '', rustdeskId: '' });

        } catch (err) {
            showError(`Failed to save device: ${getErrorMessage(err)}`);
        }
    };

    const clearTableFilters = () => {
        setNameFilter('');
        setMacFilter('');
        setIpFilter('');
        setStatusFilter('');
        setSortBy('name');
        setSortOrder('asc');
    };

    const getDeviceTypeIcon = (deviceName?: string) => {
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
    const getFilteredDevices = useCallback((deviceList: Device[]) => {
        const filtered = deviceList.filter((device: Device) => {
            const deviceName = (device.name || 'Unknown').toLowerCase();
            const deviceMac = normalizeMacForApi(device.macNormalized || device.mac || '');
            const deviceIp = (device.ip || '').toLowerCase();
            const deviceStatus = (device.status || '').toLowerCase();

            // Apply search query (matches name, mac, or ip)
            if (nameFilter) {
                const q = nameFilter.toLowerCase().trim();
                const qMac = normalizeMacForApi(q);
                const matchesName = deviceName.includes(q);
                const matchesMac = qMac ? deviceMac.includes(qMac) : false;
                const matchesIp = deviceIp.includes(q);
                if (!matchesName && !matchesMac && !matchesIp) return false;
            }
            if (macFilter && !deviceMac.includes(normalizeMacForApi(macFilter))) return false;
            if (ipFilter && !deviceIp.replace('.', '').includes(ipFilter.replace('.', '').toLowerCase())) return false;
            if (statusFilter && !deviceStatus.includes(statusFilter.toLowerCase())) return false;
            if (!prefs.showOfflineDevices && deviceStatus !== 'online') return false;

            return true;
        });

        // Sort the filtered results - always show favorites first
        return filtered.sort((a: Device, b: Device) => {
            // First, sort by favorite status (favorites always on top)
            if (a.isFavorite !== b.isFavorite) {
                return b.isFavorite ? 1 : -1;
            }

            // If both are favorites or both are discovered, sort by the selected criteria
            let aValue = '', bValue = '';

            switch (sortBy) {
                case 'name':
                    aValue = (a.name || 'Unknown').toLowerCase();
                    bValue = (b.name || 'Unknown').toLowerCase();
                    break;
                case 'mac':
                    aValue = (a.mac || '').toLowerCase();
                    bValue = (b.mac || '').toLowerCase();
                    break;
                case 'ip':
                    aValue = (a.ip || '').toLowerCase();
                    bValue = (b.ip || '').toLowerCase();
                    break;
                case 'status':
                    aValue = (a.status || '').toLowerCase();
                    bValue = (b.status || '').toLowerCase();
                    break;
                case 'isFavorite':
                    aValue = (a.name || 'Unknown').toLowerCase();
                    bValue = (b.name || 'Unknown').toLowerCase();
                    break;
                default:
                    aValue = (a.name || 'Unknown').toLowerCase();
                    bValue = (b.name || 'Unknown').toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });
    }, [nameFilter, macFilter, ipFilter, statusFilter, sortBy, sortOrder, prefs.showOfflineDevices]);

    const hasActiveFilters = Boolean(nameFilter || macFilter || ipFilter || statusFilter);

    const filteredAllDevices = useMemo(() => {
        return getFilteredDevices(devices);
    }, [devices, getFilteredDevices]);

    useEffect(() => {
        setPage(0);
    }, [nameFilter, macFilter, ipFilter, statusFilter, prefs.showOfflineDevices, prefs.devicesPerPage]);

    const pagedDevices = useMemo(() => {
        const size = prefs.devicesPerPage;
        const start = page * size;
        return filteredAllDevices.slice(start, start + size);
    }, [filteredAllDevices, page, prefs.devicesPerPage]);

    const renderCards = () => (
        <>
            {pagedDevices.length > 0 ? (
                <Grid container spacing={2}>
                    {pagedDevices.map((device) => (
                        <Grid key={device.macNormalized || device.mac} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                            <Card
                                variant="outlined"
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    borderRadius: 2.5,
                                    borderColor: device.isFavorite ? 'primary.main' : 'divider',
                                    ...(device.isFavorite && {
                                        boxShadow: (theme) =>
                                            `0 0 0 1px ${theme.palette.primary.main}`,
                                    }),
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1, p: prefs.compactMode ? 1.5 : 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                            <Box sx={{ color: 'primary.main', display: 'flex' }}>
                                                {getDeviceTypeIcon(device.name)}
                                            </Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                                                {device.name || 'Unknown Device'}
                                            </Typography>
                                        </Stack>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleToggleFavorite(device)}
                                            sx={{ color: device.isFavorite ? 'warning.main' : 'text.secondary' }}
                                        >
                                            {device.isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                                        </IconButton>
                                    </Box>

                                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Status
                                            </Typography>
                                            <Chip
                                                size="small"
                                                icon={device.status === 'online' ? <OnlineIcon /> : <OfflineIcon />}
                                                label={device.status === 'online' ? 'Online' : 'Offline'}
                                                color={device.status === 'online' ? 'success' : 'default'}
                                                variant="outlined"
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                IP Address
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                {device.ip || '—'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                MAC Address
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {formatMacForDisplay(device.macNormalized || device.mac) || '—'}
                                            </Typography>
                                        </Box>
                                        {device.description && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {device.description}
                                            </Typography>
                                        )}
                                    </Stack>
                                </CardContent>

                                <Divider />
                                <Box sx={{ p: prefs.compactMode ? 1 : 1.5 }}>
                                    <Stack spacing={1} direction={prefs.compactMode ? 'row' : 'column'}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            startIcon={<PowerIcon />}
                                            onClick={() => handleWakeOnLan(device)}
                                            color="primary"
                                            size={prefs.compactMode ? 'small' : 'medium'}
                                        >
                                            {prefs.compactMode ? 'Wake' : 'Wake Device'}
                                        </Button>
                                        {device.rustdeskId && (
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={!rustdeskConfig.available ? <WarningIcon /> : <RustDeskIcon />}
                                                onClick={() => handleRustDeskConnect(device)}
                                                color={!rustdeskConfig.available ? "warning" : "secondary"}
                                                size={prefs.compactMode ? 'small' : 'medium'}
                                            >
                                                {prefs.compactMode ? 'Remote' : 'Connect RustDesk'}
                                            </Button>
                                        )}
                                        {device.isFavorite && (
                                            <Button
                                                fullWidth={!prefs.compactMode}
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
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.selected', borderRadius: 2.5 }}>
                    <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        No Devices Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {devices.length === 0
                            ? 'No devices available. Try running a network scan or add devices manually.'
                            : 'No devices match your current search or filters. Try adjusting your criteria.'
                        }
                    </Typography>
                </Paper>
            )}
        </>
    );

    const SortHeaderButton = ({
        label,
        field,
    }: {
        label: string;
        field: 'name' | 'mac' | 'ip' | 'status';
    }) => (
        <Button
            size="small"
            onClick={() => {
                if (sortBy === field) {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                    setSortBy(field);
                    setSortOrder('asc');
                }
            }}
            endIcon={
                sortBy === field
                    ? (sortOrder === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />)
                    : undefined
            }
            sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: 'text.primary',
                minWidth: 0,
                px: 0.5,
                justifyContent: 'flex-start',
            }}
        >
            {label}
        </Button>
    );

    const renderFilterToolbar = () => (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5 }}>
            <Grid container spacing={2} alignItems="center">
                {/* Search Bar */}
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search name, MAC, or IP…"
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: nameFilter ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setNameFilter('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                    />
                </Grid>

                {/* Status Dropdown */}
                <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl size="small" fullWidth>
                        <Select
                            value={statusFilter}
                            displayEmpty
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="">Status: All</MenuItem>
                            <MenuItem value="online">Online</MenuItem>
                            <MenuItem value="offline">Offline</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {/* Show Offline Toggle */}
                <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={prefs.showOfflineDevices}
                                onChange={(e) => void persistDevicePrefs({ showOfflineDevices: e.target.checked })}
                            />
                        }
                        label="Show Offline"
                        sx={{ typography: 'body2', m: 0 }}
                    />
                </Grid>

                {/* View Mode & Actions */}
                <Grid size={{ xs: 12, md: 3.5 }} sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', flexWrap: 'wrap' }}>
                    {hasActiveFilters && (
                        <Button size="small" color="inherit" onClick={clearTableFilters} startIcon={<ClearIcon />}>
                            Clear Filters
                        </Button>
                    )}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_e, newView: DeviceViewMode | null) => {
                            if (newView) {
                                setViewMode(newView);
                                void persistDevicePrefs({
                                    deviceListView: viewModeToSetting(newView),
                                });
                            }
                        }}
                        size="small"
                    >
                        <ToggleButton value="cards" aria-label="Grid view">
                            <CardViewIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="table" aria-label="List view">
                            <TableViewIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Grid>
            </Grid>
        </Paper>
    );

    const renderDevicesTable = () => (
        <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
                mb: 3,
                overflowX: 'auto',
                borderRadius: 2.5,
            }}
        >
            <Table size={prefs.compactMode ? 'small' : 'medium'}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ py: 1.5 }}>
                            <SortHeaderButton label="Name" field="name" />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                            <SortHeaderButton label="MAC Address" field="mac" />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                            <SortHeaderButton label="IP Address" field="ip" />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                            <SortHeaderButton label="Status" field="status" />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                            Actions
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {pagedDevices.length > 0 ? (
                        pagedDevices.map((device) => (
                            <TableRow key={device.macNormalized || device.mac} hover>
                                <TableCell>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleToggleFavorite(device)}
                                            sx={{ color: device.isFavorite ? 'warning.main' : 'text.secondary' }}
                                        >
                                            {device.isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                                        </IconButton>
                                        <Box sx={{ color: 'primary.main', display: 'flex' }}>
                                            {getDeviceTypeIcon(device.name)}
                                        </Box>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                                {device.name || 'Unknown Device'}
                                            </Typography>
                                            {device.description && (
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {device.description}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                </TableCell>
                                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMacForDisplay(device.macNormalized || device.mac) || '—'}
                                </TableCell>
                                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {device.ip || '—'}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        icon={device.status === 'online' ? <OnlineIcon /> : <OfflineIcon />}
                                        label={device.status === 'online' ? 'Online' : 'Offline'}
                                        color={device.status === 'online' ? 'success' : 'default'}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                        <Tooltip title="Wake Device">
                                            <IconButton
                                                onClick={() => handleWakeOnLan(device)}
                                                color="primary"
                                                size="small"
                                            >
                                                <PowerIcon />
                                            </IconButton>
                                        </Tooltip>
                                        {device.rustdeskId && (
                                            <Tooltip title={!rustdeskConfig.available ? "RustDesk Config Missing" : "Connect RustDesk"}>
                                                <IconButton
                                                    onClick={() => handleRustDeskConnect(device)}
                                                    color={!rustdeskConfig.available ? "warning" : "secondary"}
                                                    size="small"
                                                >
                                                    {!rustdeskConfig.available ? <WarningIcon /> : <RustDeskIcon />}
                                                </IconButton>
                                            </Tooltip>
                                        )}
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
                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                                <ComputerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, display: 'block', mx: 'auto' }} />
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    No Devices Found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {devices.length === 0
                                        ? 'No devices available. Try running a network scan or add devices manually.'
                                        : 'No devices match your current search or filters. Try adjusting your criteria.'
                                    }
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );

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
        <Container
            maxWidth="xl"
            sx={{
                py: 4,
                px: { xs: 1, sm: 2, md: 3 }
            }}
        >
            {/* Header Section */}
            <Box sx={{ mb: 3 }}>
                <PageHeader
                    title="Devices"
                    icon={<DevicesIcon />}
                    actions={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddDevice}
                            >
                                Add Favorite
                            </Button>
                            <Button
                                variant="outlined"
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
                            <Tooltip title="Clear non-favorite discovered devices & rescan">
                                <IconButton
                                    color="warning"
                                    onClick={handleClearCache}
                                    disabled={refreshingAll || clearingCache}
                                    sx={{ border: '1px solid', borderColor: 'warning.main', borderRadius: 1.5 }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    }
                />

                {/* Compact Stats Badges */}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                    <Chip
                        label={`Total: ${devices.length}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        label={`Online: ${devices.filter((d) => d.status === 'online').length}`}
                        color="success"
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        label={`Favorites: ${devices.filter((d) => d.isFavorite).length}`}
                        color="info"
                        variant="outlined"
                        size="small"
                    />
                </Stack>
            </Box>

            {/* Responsive Search & Filter Toolbar */}
            {renderFilterToolbar()}

            {/* Display table view or cards view */}
            <Box sx={{ mb: 4 }}>
                {viewMode === 'table' ? renderDevicesTable() : renderCards()}
                {filteredAllDevices.length > 0 && (
                    <TablePagination
                        component="div"
                        count={filteredAllDevices.length}
                        page={page}
                        onPageChange={(_e, next) => setPage(next)}
                        rowsPerPage={prefs.devicesPerPage}
                        onRowsPerPageChange={(e) => {
                            const next = clampDevicesPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                            void persistDevicePrefs({ devicesPerPage: next });
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    />
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
