// src/components/System.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    CircularProgress,
    Container,
    Paper,
    Switch,
    FormControlLabel,
    IconButton,
    LinearProgress,
    Chip,
    Tabs,
    Tab,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    FormControl,
    Select,
    MenuItem,
} from '@mui/material';
import {
    Memory as MemoryIcon,
    Storage as StorageIcon,
    Speed as CpuIcon,
    DeviceThermostat as TempIcon,
    Refresh as RefreshIcon,
    Timeline as NetworkIcon,
    Computer as ComputerIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Settings as ServiceIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

const System = () => {
    const [systemInfo, setSystemInfo] = useState(null);
    const [resources, setResources] = useState(null);
    const [services, setServices] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(() => {
        // Load auto-refresh setting from localStorage, default to true
        const saved = localStorage.getItem('systemAutoRefresh');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [refreshing, setRefreshing] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [serviceSearchTerm, setServiceSearchTerm] = useState('');
    const [serviceStateFilter, setServiceStateFilter] = useState('all');
    const [servicePresetFilter, setServicePresetFilter] = useState('all');
    const [serviceActiveFilter, setServiceActiveFilter] = useState('all');
    const { showError } = useNotification();

    const fetchSystemData = async () => {
        try {
            // Fetch all system data in a single request
            const systemDataResult = await tryApiCall('/system');

            const data = systemDataResult.data;

            // Set all state from the combined response
            setSystemInfo(data.system);
            setResources(data.resources);
            setServices(data.services);
            setTemperature(data.temperature || { cpu: 'N/A', gpu: 'N/A' });

            setLoading(false);
        } catch (err) {
            // Use the specific error message from the API
            showError(err.message || 'Unable to connect to API server');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSystemData();

        let interval;
        if (autoRefresh) {
            interval = setInterval(async () => {
                try {
                    // Use tryApiCall for refresh
                    const systemDataResult = await tryApiCall('/system');
                    const systemData = systemDataResult.data;

                    if (systemData) {
                        // Update all state from combined response
                        if (systemData.resources) setResources(systemData.resources);
                        if (systemData.temperature) setTemperature(systemData.temperature);
                        if (systemData.services) setServices(systemData.services);
                    }
                } catch (err) {
                    // Don't show error for refresh failures
                }
            }, 10000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    // Save auto-refresh setting to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('systemAutoRefresh', JSON.stringify(autoRefresh));
    }, [autoRefresh]);

    const handleAutoRefreshToggle = (event) => {
        setAutoRefresh(event.target.checked);
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        await fetchSystemData();
        setRefreshing(false);
    };

    const formatBytes = (bytes) => {
        if (bytes === 0 || !bytes || bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = Math.floor(Math.log(bytes) / Math.log(k));
        i = Math.max(0, Math.min(i, sizes.length - 1)); // Ensure i is an int between 0 and sizes.length - 1
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const getUsageColor = (percentage) => {
        if (percentage < 50) return 'success';
        if (percentage < 80) return 'warning';
        return 'error';
    };

    // Service filter logic
    const filteredServices = React.useMemo(() => {
        if (!services) return [];
        // Sort: active desc, enabled asc, preset asc
        const sorted = [...services].sort((a, b) => {
            // 1. Active: true ("active") before false ("inactive")
            if (a.active !== b.active) return b.active - a.active;

            // 2. Enabled: "enabled" before "disabled" (and others after)
            const enabledOrder = (val) => {
                if (!val) return 2;
                const v = val.toLowerCase();
                if (v === "enabled" || v === "enabled-runtime" || v === "active") return 0;
                if (v === "disabled") return 1;
                return 2;
            };
            const aEnabled = enabledOrder(a.state);
            const bEnabled = enabledOrder(b.state);
            if (aEnabled !== bEnabled) return aEnabled - bEnabled;

            // 3. Preset: "enabled" before "disabled" (and others after)
            const presetOrder = (val) => {
                if (!val) return 2;
                const v = val.toLowerCase();
                if (v === "enabled" || v === "enabled-runtime" || v === "active") return 0;
                if (v === "disabled") return 1;
                return 2;
            };
            const aPreset = presetOrder(a.preset);
            const bPreset = presetOrder(b.preset);
            if (aPreset !== bPreset) return aPreset - bPreset;

            // 4. Alphabetical by name as fallback
            return (a.name || '').localeCompare(b.name || '');
        });
        return sorted.filter(service => {
            const matchesName = service.name?.toLowerCase().includes(serviceSearchTerm.toLowerCase());
            const matchesState = serviceStateFilter === 'all' || service.state === serviceStateFilter;
            const matchesPreset = servicePresetFilter === 'all' || (service.preset || '-') === servicePresetFilter;
            const matchesActive = serviceActiveFilter === 'all' || (service.active ? 'active' : 'inactive') === serviceActiveFilter;
            const hiddenState = service.state === 'static' || service.state === 'alias' || service.state === 'indirect' || service.state === 'generated';
            return matchesName && matchesState && matchesPreset && matchesActive && !hiddenState;
        });
    }, [services, serviceSearchTerm, serviceStateFilter, servicePresetFilter, serviceActiveFilter]);

    const uniqueServiceStates = React.useMemo(() => {
        if (!filteredServices) return [];
        return Array.from(new Set(filteredServices.map(s => s.state))).sort();
    }, [filteredServices]);

    const uniqueServicePresets = React.useMemo(() => {
        if (!filteredServices) return [];
        return Array.from(new Set(filteredServices.map(s => s.preset || '-'))).sort();
    }, [filteredServices]);

    const uniqueServiceActive = React.useMemo(() => {
        if (!filteredServices) return [];
        return Array.from(new Set(filteredServices.map(s => s.active ? 'active' : 'inactive')));
    }, [filteredServices]);

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
                        Loading system information...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
                mb: 3,
                gap: { xs: 2, md: 0 }
            }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        System Overview
                    </Typography>
                    <Chip
                        label="System Online"
                        color="success"
                        icon={<CheckIcon />}
                        sx={{ mb: 2 }}
                    />
                </Box>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    gap: 2
                }}>
                    <Paper
                        elevation={1}
                        sx={{
                            p: 2,
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={autoRefresh}
                                            onChange={handleAutoRefreshToggle}
                                            color="primary"
                                        />
                                    }
                                    label="Auto-refresh (10s)"
                                    sx={{ m: 0 }}
                                />
                                <IconButton
                                    onClick={handleManualRefresh}
                                    disabled={refreshing}
                                    color="primary"
                                    size="small"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        '&:hover': {
                                            bgcolor: 'primary.dark'
                                        },
                                        '&:disabled': {
                                            bgcolor: 'action.disabledBackground'
                                        }
                                    }}
                                >
                                    <RefreshIcon sx={{
                                        animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                        '@keyframes spin': {
                                            '0%': { transform: 'rotate(0deg)' },
                                            '100%': { transform: 'rotate(360deg)' }
                                        }
                                    }} />
                                </IconButton>
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    textAlign: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                }}
                            >
                                Last updated: {new Date().toLocaleString()}
                            </Typography>
                        </Box>
                    </Paper>
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        aria-label="system tabs"
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
                            icon={<ComputerIcon />}
                            iconPosition="start"
                            label="Overview"
                            id="system-tab-0"
                            aria-controls="system-tabpanel-0"
                            sx={{
                                minWidth: { xs: 'auto', sm: 120 },
                                '& .MuiTab-iconWrapper': {
                                    display: { xs: 'none', sm: 'block' }
                                }
                            }}
                        />
                        <Tab
                            icon={<MemoryIcon />}
                            iconPosition="start"
                            label="Resources"
                            id="system-tab-1"
                            aria-controls="system-tabpanel-1"
                            sx={{
                                minWidth: { xs: 'auto', sm: 120 },
                                '& .MuiTab-iconWrapper': {
                                    display: { xs: 'none', sm: 'block' }
                                }
                            }}
                        />
                        <Tab
                            icon={<ServiceIcon />}
                            iconPosition="start"
                            label="Services"
                            id="system-tab-2"
                            aria-controls="system-tabpanel-2"
                            sx={{
                                minWidth: { xs: 'auto', sm: 120 },
                                '& .MuiTab-iconWrapper': {
                                    display: { xs: 'none', sm: 'block' }
                                }
                            }}
                        />
                        <Tab
                            icon={<NetworkIcon />}
                            iconPosition="start"
                            label="Network"
                            id="system-tab-3"
                            aria-controls="system-tabpanel-3"
                            sx={{
                                minWidth: { xs: 'auto', sm: 120 },
                                '& .MuiTab-iconWrapper': {
                                    display: { xs: 'none', sm: 'block' }
                                }
                            }}
                        />
                    </Tabs>
                </Box>

                {/* Overview Tab */}
                <Box
                    role="tabpanel"
                    hidden={tabValue !== 0}
                    id="system-tabpanel-0"
                    aria-labelledby="system-tab-0"
                >
                    {tabValue === 0 && (
                        <Grid container spacing={3}>
                            {/* System Information */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <ComputerIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                System Information
                                            </Typography>
                                        </Box>
                                        {systemInfo ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Hostname:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {systemInfo.hostname || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Platform:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {systemInfo.platform || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">CPU:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {systemInfo.cpus?.[0]?.model?.split(' ')[0] || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Cores:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {systemInfo.cpus?.length || resources?.cpu?.cores || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Uptime:</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {systemInfo.uptime ? formatUptime(systemInfo.uptime) : 'N/A'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography color="text.secondary">No system data available</Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Temperature */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <TempIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    Temperature
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {temperature ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <Paper sx={{ p: 2, bgcolor: 'action.selected' }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="body2" color="text.secondary">CPU:</Typography>
                                                        <Chip
                                                            label={`${temperature.cpu || 'N/A'}°C`}
                                                            color={temperature.cpu > 75 ? 'error' : temperature.cpu > 60 ? 'warning' : 'success'}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                </Paper>
                                                {temperature.gpu && temperature.gpu !== 'N/A' && (
                                                    <Paper sx={{ p: 2, bgcolor: 'action.selected' }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Typography variant="body2" color="text.secondary">GPU:</Typography>
                                                            <Chip
                                                                label={`${temperature.gpu}°C`}
                                                                color={temperature.gpu > 75 ? 'error' : temperature.gpu > 60 ? 'warning' : 'success'}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                    </Paper>
                                                )}
                                            </Box>
                                        ) : (
                                            <Typography color="text.secondary">No temperature data available</Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </Box>

                {/* Resources Tab */}
                <Box
                    role="tabpanel"
                    hidden={tabValue !== 1}
                    id="system-tabpanel-1"
                    aria-labelledby="system-tab-1"
                >
                    {tabValue === 1 && (
                        <Grid container spacing={3}>
                            {/* CPU Usage */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <CpuIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    CPU Usage
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {resources?.cpu ? (
                                            <Box>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                                                    {resources.cpu.usage ?? 'N/A'}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={resources.cpu.usage ?? 0}
                                                    color={getUsageColor(resources.cpu.usage ?? 0)}
                                                    sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                                />
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Cores:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {resources.cpu.cores ?? systemInfo?.cpus?.length ?? 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography color="text.secondary">No CPU data available</Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Memory Usage */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <MemoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    Memory
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {resources?.memory || systemInfo?.memory ? (
                                            <Box>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                                                    {resources?.memory?.percentage ??
                                                        (systemInfo?.memory ? ((systemInfo.memory.used / systemInfo.memory.total) * 100).toFixed(1) : 'N/A')}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={resources?.memory?.percentage ??
                                                        (systemInfo?.memory ? (systemInfo.memory.used / systemInfo.memory.total) * 100 : 0)}
                                                    color={getUsageColor(resources?.memory?.percentage ??
                                                        (systemInfo?.memory ? (systemInfo.memory.used / systemInfo.memory.total) * 100 : 0))}
                                                    sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                                />
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Total:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources?.memory?.total ?? systemInfo?.memory?.total ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Used:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources?.memory?.used ?? systemInfo?.memory?.used ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Free:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources?.memory?.free ?? systemInfo?.memory?.free ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography color="text.secondary">No memory data available</Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Disk Usage */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    Disk Usage
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {resources?.disk ? (
                                            <Box>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                                                    {resources.disk.percentage ?? 'N/A'}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={resources.disk.percentage ?? 0}
                                                    color={getUsageColor(resources.disk.percentage ?? 0)}
                                                    sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                                />
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Total:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources.disk.total ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Used:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources.disk.used ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Free:</Typography>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatBytes(resources.disk.free ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        ) : systemInfo?.storage && systemInfo.storage.length > 0 ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {systemInfo.storage.slice(0, 2).map((disk, index) => (
                                                    <Paper key={index} sx={{ p: 2, bgcolor: 'action.selected' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                                                            {disk.filesystem}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Size:</Typography>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                {disk.size}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">Used:</Typography>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                {disk.used}
                                                            </Typography>
                                                        </Box>
                                                    </Paper>
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography color="text.secondary">No disk data available</Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Process Information (if available) */}
                            {resources?.processes && (
                                <Grid size={{ xs: 12 }}>
                                    <Card sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                                System Processes
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid size={4}>
                                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'action.selected' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                                            {resources.processes.total ?? 0}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Total
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid size={4}>
                                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                            {resources.processes.running ?? 0}
                                                        </Typography>
                                                        <Typography variant="body2" color="inherit">
                                                            Running
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid size={4}>
                                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                            {resources.processes.sleeping ?? 0}
                                                        </Typography>
                                                        <Typography variant="body2" color="inherit">
                                                            Sleeping
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </Box>

                {/* Services Tab */}
                <Box
                    role="tabpanel"
                    hidden={tabValue !== 2}
                    id="system-tabpanel-2"
                    aria-labelledby="system-tab-2"
                >
                    {tabValue === 2 && (
                        <Grid container spacing={3}>
                            <Grid size={12}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <ServiceIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    System Services
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            List of all systemd services and their states.
                                        </Typography>
                                        {filteredServices ? (
                                            <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
                                                <Table size="small" stickyHeader>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    bgcolor: 'background.paper',
                                                                    pb: 1,
                                                                    width: '30%',
                                                                }}
                                                            >
                                                                Service Name
                                                                <TextField
                                                                    placeholder="Search services..."
                                                                    value={serviceSearchTerm}
                                                                    onChange={e => setServiceSearchTerm(e.target.value)}
                                                                    size="small"
                                                                    InputProps={{
                                                                        startAdornment: (
                                                                            <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                                        ),
                                                                    }}
                                                                    sx={{ mt: 1, width: '100%' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    bgcolor: 'background.paper',
                                                                    pb: 1,
                                                                    width: '10%',
                                                                }}
                                                            >
                                                                Active
                                                                <FormControl size="small" sx={{ mt: 1, width: '100%' }}>
                                                                    <Select
                                                                        value={serviceActiveFilter}
                                                                        onChange={e => setServiceActiveFilter(e.target.value)}
                                                                        displayEmpty
                                                                    >
                                                                        <MenuItem value="all">All</MenuItem>
                                                                        {uniqueServiceActive.map(val => (
                                                                            <MenuItem key={val} value={val}>
                                                                                {val.charAt(0).toUpperCase() + val.slice(1)}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            </TableCell>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    bgcolor: 'background.paper',
                                                                    pb: 1,
                                                                    width: '10%',
                                                                }}
                                                            >
                                                                Enabled
                                                                <FormControl size="small" sx={{ mt: 1, width: '100%' }}>
                                                                    <Select
                                                                        value={serviceStateFilter}
                                                                        onChange={e => setServiceStateFilter(e.target.value)}
                                                                        displayEmpty
                                                                    >
                                                                        <MenuItem value="all">All</MenuItem>
                                                                        {uniqueServiceStates.map(state => (
                                                                            <MenuItem key={state} value={state}>
                                                                                {state.charAt(0).toUpperCase() + state.slice(1)}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            </TableCell>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    bgcolor: 'background.paper',
                                                                    pb: 1,
                                                                    width: '15%',
                                                                }}
                                                            >
                                                                Preset
                                                                <FormControl size="small" sx={{ mt: 1, width: '100%' }}>
                                                                    <Select
                                                                        value={servicePresetFilter}
                                                                        onChange={e => setServicePresetFilter(e.target.value)}
                                                                        displayEmpty
                                                                    >
                                                                        <MenuItem value="all">All</MenuItem>
                                                                        {uniqueServicePresets.map(preset => (
                                                                            <MenuItem key={preset} value={preset}>
                                                                                {preset.charAt(0).toUpperCase() + preset.slice(1)}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {filteredServices.map((service, index) => (
                                                            <TableRow key={service.name} hover>
                                                                <TableCell>
                                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                                        {service.name}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={service.active ? 'Active' : 'Inactive'}
                                                                        size="small"
                                                                        color={service.active ? 'success' : 'default'}
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={service.state ? service.state.charAt(0).toUpperCase() + service.state.slice(1) : ''}
                                                                        size="small"
                                                                        color={
                                                                            service.state === 'enabled' || service.state === 'enabled-runtime' || service.state === 'active'
                                                                                ? 'info'
                                                                                : service.state === 'disabled'
                                                                                    ? 'default'
                                                                                    : 'warning'
                                                                        }
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={service.preset ? service.preset.charAt(0).toUpperCase() + service.preset.slice(1) : ''}
                                                                        size="small"
                                                                        color={
                                                                            service.preset === 'enabled' || service.preset === 'enabled-runtime' || service.preset === 'active'
                                                                                ? 'info'
                                                                                : service.preset === 'disabled'
                                                                                    ? 'default'
                                                                                    : 'warning'
                                                                        }
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        ) : (
                                            <Paper
                                                variant="outlined"
                                                sx={{
                                                    p: 4,
                                                    textAlign: 'center',
                                                    bgcolor: 'action.hover'
                                                }}
                                            >
                                                <Typography color="text.secondary" variant="h6" sx={{ mb: 1 }}>
                                                    No services found
                                                </Typography>
                                                <Typography color="text.secondary" variant="body2">
                                                    No systemd services detected on this system.
                                                </Typography>
                                            </Paper>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </Box>

                {/* Network Tab */}
                <Box
                    role="tabpanel"
                    hidden={tabValue !== 3}
                    id="system-tabpanel-3"
                    aria-labelledby="system-tab-3"
                >
                    {tabValue === 3 && (
                        <Grid container spacing={3}>
                            {/* Network Interfaces */}
                            {resources?.network?.interfaces && resources.network.interfaces.length > 0 ? (
                                <Grid size={12}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                                <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    Network Interfaces
                                                </Typography>
                                                {resources.network?.source && (
                                                    <Chip
                                                        label={`Source: ${resources.network.source}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ ml: 'auto' }}
                                                    />
                                                )}
                                            </Box>
                                            <Grid container spacing={2}>
                                                {resources.network.interfaces.map((iface, index) => (
                                                    <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
                                                        <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                                                                    {iface.name}
                                                                </Typography>
                                                                <Chip
                                                                    label={iface.active ? 'Active' : 'Inactive'}
                                                                    size="small"
                                                                    color={iface.active ? 'success' : 'default'}
                                                                />
                                                            </Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Download:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                                    {iface.downloadSpeed !== undefined && iface.downloadSpeed !== null
                                                                        ? `${formatBytes(iface.downloadSpeed)}/s`
                                                                        : 'N/A'
                                                                    }
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Upload:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                                    {iface.uploadSpeed !== undefined && iface.uploadSpeed !== null
                                                                        ? `${formatBytes(iface.uploadSpeed)}/s`
                                                                        : 'N/A'
                                                                    }
                                                                </Typography>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ) : (
                                <Grid size={12}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    Network Interfaces
                                                </Typography>
                                            </Box>
                                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                                Network interface data unavailable.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </Box>
            </Box>
        </Container>
    );
};

export default System;
