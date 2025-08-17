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
    // Other icons...
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

// --- Helper Components for better visualization (Suggestion) ---

// A simple gauge component using MUI's CircularProgress
const Gauge = ({ value, color, title }) => (
    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
        <CircularProgress
            variant="determinate"
            value={100}
            size={100}
            thickness={4}
            sx={{ color: (theme) => theme.palette.grey[theme.palette.mode === 'light' ? 200 : 700] }}
        />
        <CircularProgress
            variant="determinate"
            value={value}
            size={100}
            thickness={4}
            color={color}
            sx={{
                position: 'absolute',
                left: 0,
                animationDuration: '550ms',
                transition: 'transform .4s ease-in-out'
            }}
        />
        <Box
            top={0}
            left={0}
            bottom={0}
            right={0}
            position="absolute"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
        >
            <Typography variant="h5" component="div" color="text.primary" sx={{ fontWeight: 'bold' }}>
                {`${Math.round(value)}%`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {title}
            </Typography>
        </Box>
    </Box>
);


const System = () => {
    const [systemInfo, setSystemInfo] = useState(null);
    const [resources, setResources] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [network, setNetwork] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(() => {
        const saved = localStorage.getItem('systemAutoRefresh');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [refreshing, setRefreshing] = useState(false);
    const { showError } = useNotification();

    // ... (fetchSystemData, useEffect hooks, and helper functions remain the same) ...
    const fetchSystemData = async () => {
        try {
            const systemDataResult = await tryApiCall('/system');
            const data = systemDataResult.data;
            setSystemInfo(data.system);
            setResources(data.resources);
            setTemperature(data.temperature);
            setNetwork(data.network);
        } catch (err) {
            showError(err.message || 'Unable to connect to API server');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSystemData();
        let interval;
        if (autoRefresh) {
            interval = setInterval(async () => {
                try {
                    const systemDataResult = await tryApiCall('/system');
                    const systemData = systemDataResult.data;
                    if (systemData) {
                        if (systemData.resources) setResources(systemData.resources);
                        if (systemData.temperature) setTemperature(systemData.temperature);
                        if (systemData.network) setNetwork(systemData.network);
                        if (systemData.system) setSystemInfo(systemData.system);
                    }
                } catch (err) {
                    console.error("Auto-refresh failed:", err);
                }
            }, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    useEffect(() => {
        localStorage.setItem('systemAutoRefresh', JSON.stringify(autoRefresh));
    }, [autoRefresh]);

    const handleAutoRefreshToggle = (event) => {
        setAutoRefresh(event.target.checked);
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        await fetchSystemData();
    };

    const formatBytes = (bytes) => {
        // Normalize and validate input
        if (bytes === 0) return '0 B';
        if (bytes == null || isNaN(Number(bytes))) return '0 B';
        const num = Number(bytes);
        if (num <= 0) return '0 B';
        if (num < 1) return '1 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(num) / Math.log(k));
        const idx = Math.min(Math.max(i, 0), sizes.length - 1);
        const value = num / Math.pow(k, idx);
        return `${parseFloat(value.toFixed(1))} ${sizes[idx]}`;
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
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 200px)' }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">Loading system information...</Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
            {/* Header remains the same */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, mb: 4, gap: 2 }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>System Dashboard</Typography>
                    <Chip label="System Online" color="success" icon={<CheckIcon />} />
                </Box>
                <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <FormControlLabel control={<Switch checked={autoRefresh} onChange={handleAutoRefreshToggle} />} label="Auto-refresh" />
                        <IconButton onClick={handleManualRefresh} disabled={refreshing} color="primary" sx={{ '&:disabled': { bgcolor: 'action.disabledBackground' } }}>
                            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
                        </IconButton>
                    </Box>
                </Paper>
            </Box>

            {/* Unified Dashboard Grid - All cards are placed here */}
            <Grid container spacing={3}>
                {/* --- Row 1: Key Resource Metrics --- */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CpuIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>CPU</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                                {resources?.cpu ? (
                                    <Gauge
                                        value={resources.cpu.usage ?? 0}
                                        color={getUsageColor(resources.cpu.usage ?? 0)}
                                    // title={`${resources.cpu.cores ?? '?'} Cores`}
                                    />
                                ) : <Typography color="text.secondary">No CPU data</Typography>}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <MemoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Memory</Typography>
                            </Box>
                            {resources?.memory ? (
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{resources.memory.percentage.toFixed(1)}%</Typography>
                                    <LinearProgress variant="determinate" value={resources.memory.percentage} color={getUsageColor(resources.memory.percentage)} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Used</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatBytes(resources.memory.used)} / {formatBytes(resources.memory.total)}</Typography>
                                    </Box>
                                </Box>
                            ) : <Typography color="text.secondary">No memory data</Typography>}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Disk</Typography>
                            </Box>
                            {resources?.disk ? (
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{resources.disk.percentage.toFixed(1)}%</Typography>
                                    <LinearProgress variant="determinate" value={resources.disk.percentage} color={getUsageColor(resources.disk.percentage)} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Free</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatBytes(resources.disk.available)} / {formatBytes(resources.disk.total)}</Typography>
                                    </Box>
                                </Box>
                            ) : <Typography color="text.secondary">No disk data</Typography>}
                        </CardContent>
                    </Card>
                </Grid>

                {/* --- Row 2: System Info & Vitals --- */}
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ComputerIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>System Info</Typography>
                            </Box>
                            {systemInfo ? (
                                <Box display="flex" flexDirection="column" gap={1.5}>
                                    <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Hostname:</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{systemInfo.hostname || 'N/A'}</Typography></Box>
                                    <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Platform:</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{systemInfo.platform || 'N/A'}</Typography></Box>
                                    <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Uptime:</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatUptime(systemInfo.uptime)}</Typography></Box>
                                </Box>
                            ) : <Typography color="text.secondary">No system data</Typography>}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <TempIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Temperature</Typography>
                            </Box>
                            {temperature ? (
                                <Box display="flex" flexDirection="column" gap={2}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body1">CPU Temp</Typography>
                                        <Chip
                                            label={temperature.cpu != null ? `${temperature.cpu}°C` : 'N/A'}
                                            color={temperature.cpu > 75 ? 'error' : temperature.cpu > 60 ? 'warning' : temperature.cpu != null ? 'success' : 'default'}
                                        />
                                    </Box>
                                    {temperature.gpu && (
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body1">GPU Temp</Typography>
                                            <Chip
                                                label={`${temperature.gpu}°C`}
                                                color={temperature.gpu > 75 ? 'error' : temperature.gpu > 60 ? 'warning' : 'success'}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            ) : <Typography color="text.secondary">No temp data</Typography>}
                        </CardContent>
                    </Card>
                </Grid>

                {resources?.processes &&
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Processes</Typography>
                                <Grid container spacing={1} textAlign="center">
                                    <Grid size={4}><Paper variant="outlined" sx={{ p: 1 }}><Typography variant="h5">{resources.processes.total}</Typography><Typography variant="caption">Total</Typography></Paper></Grid>
                                    <Grid size={4}><Paper variant="outlined" sx={{ p: 1, borderColor: 'success.main' }}><Typography variant="h5" color="success.main">{resources.processes.running}</Typography><Typography variant="caption">Running</Typography></Paper></Grid>
                                    <Grid size={4}><Paper variant="outlined" sx={{ p: 1, borderColor: 'warning.main' }}><Typography variant="h5" color="warning.main">{resources.processes.sleeping}</Typography><Typography variant="caption">Sleeping</Typography></Paper></Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                }

                {/* --- Row 3: Network Information --- */}
                {network?.interfaces &&
                    <Grid size={12}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Network Interfaces</Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    {network.interfaces.map((iface, index) => (
                                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                                            <Paper variant="outlined" sx={{ p: 2 }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}><Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{iface.name}</Typography><Chip label={iface.active ? 'Active' : 'Inactive'} size="small" color={iface.active ? 'success' : 'default'} /></Box>
                                                <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">↓ Download</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatBytes(iface.downloadSpeed)}/s</Typography></Box>
                                                <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">↑ Upload</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{formatBytes(iface.uploadSpeed)}/s</Typography></Box>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                }
            </Grid>
        </Container>
    );
};

export default System;