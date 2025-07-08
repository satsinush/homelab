// src/components/SystemResources.jsx
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
    IconButton,
    LinearProgress,
    Chip,
    Divider,
    Grid
} from '@mui/material';
import {
    Memory as MemoryIcon,
    Storage as StorageIcon,
    Speed as CpuIcon,
    DeviceThermostat as TempIcon,
    Refresh as RefreshIcon,
    Timeline as NetworkIcon,
    Computer as ComputerIcon
} from '@mui/icons-material';
import { tryApiCall, apiCall } from '../utils/api';

const SystemResources = () => {
    const [resources, setResources] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchResources = async () => {
        try {
            setError('');

            // Fetch resources data
            const resourcesResult = await tryApiCall('/resources');
            setResources(resourcesResult.data);

            // Store working API URL for future requests
            window.workingApiUrl = resourcesResult.baseUrl;

            // Fetch temperature data
            try {
                const tempResult = await tryApiCall('/temperature');
                setTemperature(tempResult.data);
            } catch (tempErr) {
                // Temperature might not be available, that's ok
                setTemperature({ cpu: 'N/A', gpu: 'N/A' });
            }

            setLoading(false);
        } catch (err) {
            setError('Unable to connect to API server');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();

        let interval;
        if (autoRefresh) {
            interval = setInterval(async () => {
                if (window.workingApiUrl) {
                    try {
                        const resourcesData = await apiCall(window.workingApiUrl, '/resources');
                        setResources(resourcesData);

                        try {
                            const tempData = await apiCall(window.workingApiUrl, '/temperature');
                            setTemperature(tempData);
                        } catch (tempErr) {
                            // Temperature refresh failed, ignore
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
        await fetchResources();
        setRefreshing(false);
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getUsageColor = (percentage) => {
        if (percentage < 50) return 'success';
        if (percentage < 80) return 'warning';
        return 'error';
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading system resources...
                    </Typography>
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    System Resources
                </Typography>
                <Alert severity="error">
                    <Typography variant="h6" sx={{ mb: 1 }}>⚠️ No Data Available</Typography>
                    <Typography>{error}</Typography>
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        System Resources
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                        Real-time monitoring of system performance
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                            bgcolor: 'action.selected',
                            '&:hover': { bgcolor: 'action.hover' }
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
                {/* CPU Usage */}
                <Grid size={{ xs: 12, sm: 8, lg: 6, xl: 4 }}>
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
                                                {resources.cpu.cores ?? 'N/A'}
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
                <Grid size={{ xs: 12, sm: 8, lg: 6, xl: 4 }}>
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
                            {resources?.memory ? (
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                                        {resources.memory.percentage ?? 'N/A'}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={resources.memory.percentage ?? 0}
                                        color={getUsageColor(resources.memory.percentage ?? 0)}
                                        sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                    />
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" color="text.secondary">Total:</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {formatBytes(resources.memory.total ?? 0)}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" color="text.secondary">Used:</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {formatBytes(resources.memory.used ?? 0)}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" color="text.secondary">Free:</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {formatBytes(resources.memory.free ?? 0)}
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
                <Grid size={{ xs: 12, sm: 8, lg: 6, xl: 4 }}>
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
                            ) : (
                                <Typography color="text.secondary">No disk data available</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Temperature */}
                <Grid size={{ xs: 12, sm: 8, lg: 6, xl: 4 }}>
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
                                    {/* {temperature.gpu && temperature.gpu !== 'N/A' && (
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
                                    )} */}
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No temperature data available</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Network Usage (if available) */}
                {resources?.network && (
                    <Grid size={{ xs: 12, lg: 8 }}>
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
                                        <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                            <Typography variant="body2" color="inherit" gutterBottom>
                                                Download
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {formatBytes(resources.network.download ?? 0)}/s
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid size={6}>
                                        <Paper sx={{ p: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                                            <Typography variant="body2" color="inherit" gutterBottom>
                                                Upload
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
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

                {/* Process Information (if available) */}
                {resources?.processes && (
                    <Grid size={{ xs: 12, lg: 4 }}>
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

export default SystemResources;
