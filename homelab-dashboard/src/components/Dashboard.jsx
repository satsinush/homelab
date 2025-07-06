// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Alert,
    CircularProgress,
    Container,
    Paper,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import {
    Computer as ComputerIcon,
    Storage as StorageIcon,
    Memory as MemoryIcon,
    DeviceThermostat as TempIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Settings as ServiceIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';

const Dashboard = () => {
    const [systemInfo, setSystemInfo] = useState(null);
    const [services, setServices] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSystemData = async () => {
            try {
                setError('');

                // Fetch system info
                const systemResult = await tryApiCall('/system-info');
                setSystemInfo(systemResult.data);

                // Store working API URL for future requests
                window.workingApiUrl = systemResult.baseUrl;

                // Fetch additional data in parallel
                const [servicesResult, tempResult] = await Promise.allSettled([
                    tryApiCall('/services'),
                    tryApiCall('/temperature')
                ]);

                if (servicesResult.status === 'fulfilled') {
                    setServices(servicesResult.value.data.services);
                }

                if (tempResult.status === 'fulfilled') {
                    setTemperature(tempResult.value.data);
                }

                setLoading(false);
            } catch (err) {
                setError('Unable to connect to API server');
                setLoading(false);
            }
        };

        fetchSystemData();
    }, []);

    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading system information...
                    </Typography>
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    System Overview
                </Typography>
                <Chip label="Connection Failed" color="error" sx={{ mb: 3 }} />
                <Alert severity="error">
                    <Typography variant="h6" sx={{ mb: 1 }}>⚠️ No Data Available</Typography>
                    <Typography>{error}</Typography>
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
            <Box sx={{ mb: 4 }}>
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
                                            {systemInfo.cpus?.length || 'N/A'}
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

                {/* Memory Usage */}
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <MemoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Memory Usage
                                </Typography>
                            </Box>
                            {systemInfo?.memory ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">Total:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {formatBytes(systemInfo.memory.total)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">Used:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {formatBytes(systemInfo.memory.used)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">Free:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {formatBytes(systemInfo.memory.free)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">Usage:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {((systemInfo.memory.used / systemInfo.memory.total) * 100).toFixed(1)}%
                                        </Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No memory data available</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Storage Information */}
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Storage
                                </Typography>
                            </Box>
                            {systemInfo?.storage && systemInfo.storage.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {systemInfo.storage.map((disk, index) => (
                                        <Paper key={index} sx={{ p: 2, bgcolor: 'grey.50' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                                                {disk.filesystem}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Size:</Typography>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                    {disk.size}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">Used:</Typography>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                    {disk.used}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2" color="text.secondary">Mount:</Typography>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                    {disk.mountpoint}
                                                </Typography>
                                            </Box>
                                        </Paper>
                                    ))}
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No storage data available</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Temperature (if available) */}
                {temperature && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <TempIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Temperature
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">CPU:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {temperature.cpu || 'N/A'}°C
                                        </Typography>
                                    </Box>
                                    {temperature.gpu && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="body2" color="text.secondary">GPU:</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {temperature.gpu}°C
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Services Status */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ServiceIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Services Status
                                </Typography>
                            </Box>
                            {services && services.length > 0 ? (
                                <List sx={{ py: 0 }}>
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
                                                primary={service.name}
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

                {/* Recent Activity Placeholder */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Recent Activity
                            </Typography>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                py: 4,
                                color: 'text.secondary'
                            }}>
                                <Typography variant="body2">
                                    Activity logging not yet implemented
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
};

export default Dashboard;
