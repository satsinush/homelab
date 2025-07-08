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
    ListItemIcon
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
import { tryApiCall, apiCall } from '../utils/api';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

const System = () => {
    const [systemInfo, setSystemInfo] = useState(null);
    const [resources, setResources] = useState(null);
    const [services, setServices] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { showError } = useNotification();

    const fetchSystemData = async () => {
        try {
            // Fetch system info and resources in parallel
            const [systemResult, resourcesResult] = await Promise.allSettled([
                tryApiCall('/system-info'),
                tryApiCall('/resources')
            ]);

            if (systemResult.status === 'fulfilled') {
                setSystemInfo(systemResult.value.data);
                window.workingApiUrl = systemResult.value.baseUrl;
            }

            if (resourcesResult.status === 'fulfilled') {
                setResources(resourcesResult.value.data);
                if (!window.workingApiUrl) {
                    window.workingApiUrl = resourcesResult.value.baseUrl;
                }
            }

            // Fetch additional data if we have a working API URL
            if (window.workingApiUrl) {
                const [servicesResult, tempResult] = await Promise.allSettled([
                    tryApiCall('/services'),
                    tryApiCall('/temperature')
                ]);

                if (servicesResult.status === 'fulfilled') {
                    setServices(servicesResult.value.data.services);
                }

                if (tempResult.status === 'fulfilled') {
                    setTemperature(tempResult.value.data);
                } else {
                    setTemperature({ cpu: 'N/A', gpu: 'N/A' });
                }
            }

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
                if (window.workingApiUrl) {
                    try {
                        // Refresh resources and temperature data
                        const [resourcesData, tempData] = await Promise.allSettled([
                            apiCall(window.workingApiUrl, '/resources'),
                            apiCall(window.workingApiUrl, '/temperature')
                        ]);

                        if (resourcesData.status === 'fulfilled') {
                            setResources(resourcesData.value);
                        }

                        if (tempData.status === 'fulfilled') {
                            setTemperature(tempData.value);
                        }
                    } catch (err) {
                        // Don't show error for refresh failures
                    }
                }
            }, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    const handleManualRefresh = async () => {
        setRefreshing(true);
        await fetchSystemData();
        setRefreshing(false);
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
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
                mb: 4,
                gap: { xs: 2, md: 0 }
            }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        System Overview
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                        Real-time monitoring of your homelab infrastructure
                    </Typography>
                    <Chip
                        label="System Online"
                        color="success"
                        icon={<CheckIcon />}
                        sx={{ mt: 2 }}
                    />
                </Box>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    gap: 2
                }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                color="primary"
                            />
                        }
                        label="Auto-refresh (5s)"
                    />
                    <IconButton
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        color="primary"
                        sx={{
                            bgcolor: 'primary.50',
                            '&:hover': { bgcolor: 'primary.100' }
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
            </Box>

            <Grid container spacing={3}>
                {/* System Information */}
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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

                {/* CPU Usage */}
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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

                {/* Temperature */}
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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

                {/* Network Usage (if available) */}
                {resources?.network && (
                    <Grid size={{ xs: 12, lg: 6 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Network Usage
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid size={6}>
                                        <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Download
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                {formatBytes(resources.network.download ?? 0)}/s
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid size={6}>
                                        <Paper sx={{ p: 2, bgcolor: 'secondary.50' }}>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Upload
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                                                {formatBytes(resources.network.upload ?? 0)}/s
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                </Grid>
                                {resources.network.interfaces && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Active Interfaces:
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {resources.network.interfaces.map((iface, index) => (
                                                <Chip
                                                    key={index}
                                                    label={iface}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Services Status */}
                <Grid size={{ xs: 12, lg: services ? 6 : 8 }}>
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
                                        maxHeight: 320,
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

                {/* Process Information (if available) */}
                {resources?.processes && (
                    <Grid size={{ xs: 12, lg: 6 }}>
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

            {/* Update Timestamp */}
            <Paper sx={{ p: 2, mt: 3, bgcolor: 'action.selected' }}>
                <Typography variant="body2" color="text.secondary" align="center">
                    Last updated: {new Date().toLocaleString()} •
                    {autoRefresh ? ' Auto-refreshing every 5 seconds' : ' Auto-refresh disabled'}
                </Typography>
            </Paper>
        </Container>
    );
};

export default System;
