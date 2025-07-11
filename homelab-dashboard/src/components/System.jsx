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
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Tabs,
    Tab
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
    Settings as ServiceIcon
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
    const { showError } = useNotification();

    const fetchSystemData = async () => {
        try {
            // Fetch all system data in a single request
            const systemDataResult = await tryApiCall('/system');

            const data = systemDataResult.data;

            // Set all state from the combined response
            setSystemInfo(data.system);
            setResources(data.resources);
            setServices(data.services?.services || data.services);
            setTemperature(data.temperature || { cpu: 'N/A', gpu: 'N/A' });

            setLoading(false);
        } catch (err) {
            showError('Unable to connect to API server');
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
                        if (systemData.services) setServices(systemData.services?.services || systemData.services);
                    }
                } catch (err) {
                    // Don't show error for refresh failures
                }
            }, 5000);
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
        const i = Math.floor(Math.log(bytes) / Math.log(k));
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
                                    label="Auto-refresh (5s)"
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
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <ServiceIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                Services Status
                                            </Typography>
                                        </Box>
                                        {services && services.length > 0 ? (
                                            <List
                                                sx={{
                                                    py: 0,
                                                    maxHeight: 500,
                                                    overflowY: 'auto'
                                                }}
                                            >
                                                {services.map((service, index) => (
                                                    <ListItem key={service.name} sx={{ px: 0, py: 1 }}>
                                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                                            {service.active ? (
                                                                <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
                                                            ) : (
                                                                <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                                                            )}
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={service.displayName || service.name}
                                                            secondary={service.status}
                                                        />
                                                        <Box sx={{ ml: 'auto' }}>
                                                            <Chip
                                                                label={service.status}
                                                                size="small"
                                                                color={service.active ? 'success' : 'error'}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        ) : (
                                            <Typography color="text.secondary">No service data available</Typography>
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
                            {resources?.network?.detailedInterfaces && resources.network.detailedInterfaces.length > 0 ? (
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
                                                {resources.network.detailedInterfaces.map((iface, index) => (
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
                                                                    {iface.received !== undefined && iface.received !== null
                                                                        ? `${formatBytes(iface.received)}/s`
                                                                        : 'N/A'
                                                                    }
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Upload:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                                    {iface.sent !== undefined && iface.sent !== null
                                                                        ? `${formatBytes(iface.sent)}/s`
                                                                        : 'N/A'
                                                                    }
                                                                </Typography>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                            {resources.network.timestamp && (
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                                                    Last updated: {new Date(resources.network.timestamp).toLocaleTimeString()}
                                                </Typography>
                                            )}
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
                                                No network interface data available.
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                This could be because Netdata is not running or the NETDATA_URL environment variable is not configured.
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
