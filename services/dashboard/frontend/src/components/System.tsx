// src/components/System.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    CircularProgress,
    Container,
    Switch,
    FormControlLabel,
    IconButton,
    LinearProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tooltip,
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
    Dashboard as DashboardIcon,
    InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { useNotification } from '../contexts/useNotification';
import {
    SystemInfo,
    ResourceMetrics,
    SystemTemperature,
    NetworkInfo,
    SystemDataResponse,
} from '../types/api';
import { getErrorMessage } from '../utils/errors';
import { fetchSystemMetrics } from '../utils/systemMetrics';

const CPU_TEMP_CAP_C = 80;

interface GaugeProps {
    value: number;
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'inherit';
    /** Center label; defaults to rounded percent */
    label?: string;
    title?: string;
}

const Gauge = ({ value, color, label, title }: GaugeProps) => (
    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
        <CircularProgress
            variant="determinate"
            value={100}
            size={128}
            thickness={4.5}
            sx={{ color: (theme) => theme.palette.grey[theme.palette.mode === 'light' ? 200 : 700] }}
        />
        <CircularProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, value))}
            size={128}
            thickness={4.5}
            color={color}
            sx={{
                position: 'absolute',
                left: 0,
                animationDuration: '550ms',
                transition: 'transform .4s ease-in-out',
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
            <Typography variant="h4" component="div" color="text.primary" sx={{ fontWeight: 'bold' }}>
                {label ?? `${Math.round(value)}%`}
            </Typography>
            {title && (
                <Typography variant="caption" color="text.secondary">
                    {title}
                </Typography>
            )}
        </Box>
    </Box>
);

const StatRow = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <Box display="flex" justifyContent="space-between" gap={2}>
        <Typography variant="body2" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {value}
        </Typography>
    </Box>
);

const System = () => {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [resources, setResources] = useState<ResourceMetrics | null>(null);
    const [temperature, setTemperature] = useState<SystemTemperature | null>(null);
    const [network, setNetwork] = useState<NetworkInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
        const saved = localStorage.getItem('systemAutoRefresh');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [refreshing, setRefreshing] = useState(false);
    const { showError } = useNotification();

    const applySystemData = useCallback((data: SystemDataResponse) => {
        setSystemInfo(data.system);
        setResources(data.resources);
        setTemperature(data.temperature);
        setNetwork(data.network);
        setOnline(true);
    }, []);

    const fetchSystemData = useCallback(async (force = false) => {
        try {
            const data = await fetchSystemMetrics({ force });
            applySystemData(data);
        } catch (err) {
            setOnline(false);
            showError(getErrorMessage(err) || 'Unable to connect to API server');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [applySystemData, showError]);

    useEffect(() => {
        fetchSystemData();
        let interval: ReturnType<typeof setInterval> | undefined;
        if (autoRefresh) {
            interval = setInterval(() => {
                void fetchSystemData(true).catch((err) => {
                    console.error('Auto-refresh failed:', err);
                    setOnline(false);
                });
            }, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, fetchSystemData]);

    useEffect(() => {
        localStorage.setItem('systemAutoRefresh', JSON.stringify(autoRefresh));
    }, [autoRefresh]);

    const handleAutoRefreshToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAutoRefresh(event.target.checked);
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        await fetchSystemData(true);
    };

    const formatBytes = (bytes: number | string) => {
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

    /** Fixed-width rate string so table columns don't jump (e.g. 0 B/s vs 100.5 MB/s). */
    const formatNetworkRate = (bytes: number | string) => {
        const num = Number(bytes);
        if (!Number.isFinite(num) || num <= 0) return '   0.0  B/s';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(num) / Math.log(k));
        const idx = Math.min(Math.max(i, 0), sizes.length - 1);
        const value = (num / Math.pow(k, idx)).toFixed(1).padStart(6, ' ');
        const unit = sizes[idx].padEnd(2, ' ');
        return `${value} ${unit}/s`;
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const getUsageColor = (percentage: number): 'success' | 'warning' | 'error' => {
        if (percentage < 50) return 'success';
        if (percentage < 80) return 'warning';
        return 'error';
    };

    const cpuTemp = temperature?.cpu;
    const numericTemp = cpuTemp != null && !Number.isNaN(Number(cpuTemp)) ? Number(cpuTemp) : null;
    const tempGaugeValue =
        numericTemp != null
            ? Math.min(100, Math.max(0, ((numericTemp - 30) / 70) * 100))
            : 0;
    const tempColor =
        numericTemp == null
            ? 'inherit'
            : numericTemp > 80
              ? 'error'
              : numericTemp > 60
                ? 'warning'
                : 'success';

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'calc(100vh - 200px)',
                    }}
                >
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading system information...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
            <PageHeader
                title="System"
                icon={<DashboardIcon />}
                actions={
                    <>
                        <Chip
                            label={online ? 'System Online' : 'System Offline'}
                            color={online ? 'success' : 'error'}
                            icon={<CheckIcon />}
                        />
                        <FormControlLabel
                            control={<Switch checked={autoRefresh} onChange={handleAutoRefreshToggle} />}
                            label="Auto-refresh"
                            sx={{ ml: 0.5 }}
                        />
                        <IconButton
                            onClick={handleManualRefresh}
                            disabled={refreshing}
                            color="primary"
                            sx={{ '&:disabled': { bgcolor: 'action.disabledBackground' } }}
                        >
                            <RefreshIcon
                                sx={{
                                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                                }}
                            />
                        </IconButton>
                    </>
                }
            />

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CpuIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    CPU
                                </Typography>
                                {resources?.cpu?.model && (
                                    <Tooltip title={resources.cpu.model} arrow placement="top">
                                        <IconButton size="small" sx={{ ml: 0.5, color: 'text.secondary' }} aria-label="CPU details">
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    flexGrow: 1,
                                }}
                            >
                                {resources?.cpu ? (
                                    <Gauge
                                        value={resources.cpu.usage ?? 0}
                                        color={getUsageColor(resources.cpu.usage ?? 0)}
                                        title={
                                            resources.cpu.cores != null
                                                ? `${resources.cpu.cores} cores`
                                                : undefined
                                        }
                                    />
                                ) : (
                                    <Typography color="text.secondary">No CPU data</Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <MemoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Memory
                                </Typography>
                            </Box>
                            {resources?.memory ? (
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        {resources.memory.percentage.toFixed(1)}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={resources.memory.percentage}
                                        color={getUsageColor(resources.memory.percentage)}
                                        sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                    />
                                    <Box display="flex" flexDirection="column" gap={0.75}>
                                        <StatRow
                                            label="Total"
                                            value={formatBytes(resources.memory.total)}
                                        />
                                        <StatRow
                                            label="Used"
                                            value={formatBytes(resources.memory.used)}
                                        />
                                        <StatRow
                                            label="Free"
                                            value={formatBytes(
                                                resources.memory.free ??
                                                    Math.max(
                                                        0,
                                                        Number(resources.memory.total) -
                                                            Number(resources.memory.used)
                                                    )
                                            )}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No memory data</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Disk
                                </Typography>
                            </Box>
                            {resources?.disk ? (
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        {resources.disk.percentage.toFixed(1)}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={resources.disk.percentage}
                                        color={getUsageColor(resources.disk.percentage)}
                                        sx={{ height: 8, borderRadius: 4, mb: 2 }}
                                    />
                                    <Box display="flex" flexDirection="column" gap={0.75}>
                                        <StatRow
                                            label="Total"
                                            value={formatBytes(resources.disk.total)}
                                        />
                                        <StatRow
                                            label="Used"
                                            value={formatBytes(
                                                resources.disk.used ??
                                                    Math.max(
                                                        0,
                                                        Number(resources.disk.total) -
                                                            Number(resources.disk.available)
                                                    )
                                            )}
                                        />
                                        <StatRow
                                            label="Free"
                                            value={formatBytes(resources.disk.available)}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No disk data</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ComputerIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    System Info
                                </Typography>
                            </Box>
                            {systemInfo ? (
                                <Box display="flex" flexDirection="column" gap={1.5}>
                                    <StatRow label="Hostname" value={systemInfo.hostname || 'N/A'} />
                                    <StatRow label="Platform" value={systemInfo.platform || 'N/A'} />
                                    <StatRow label="Uptime" value={formatUptime(systemInfo.uptime)} />
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No system data</Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <TempIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    CPU Temperature
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    flexGrow: 1,
                                }}
                            >
                                {cpuTemp != null ? (
                                    <Gauge
                                        value={tempGaugeValue}
                                        color={tempColor}
                                        label={`${Math.round(Number(cpuTemp))}°C`}
                                    />
                                ) : (
                                    <Typography color="text.secondary">No temp data</Typography>
                                )}
                            </Box>
                            {temperature?.gpu != null && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ mt: 1, textAlign: 'center', display: 'block' }}
                                >
                                    GPU {temperature.gpu}°C
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {network?.interfaces && network.interfaces.length > 0 && (
                    <Grid size={12}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Network Interfaces
                                    </Typography>
                                </Box>
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small" sx={{ tableLayout: 'fixed' }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell
                                                    sx={{
                                                        typography: 'overline',
                                                        letterSpacing: '0.08em',
                                                        fontWeight: 700,
                                                        color: 'text.secondary',
                                                        width: '30%',
                                                    }}
                                                >
                                                    Interface
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        typography: 'overline',
                                                        letterSpacing: '0.08em',
                                                        fontWeight: 700,
                                                        color: 'text.secondary',
                                                        width: '22%',
                                                    }}
                                                >
                                                    Status
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        typography: 'overline',
                                                        letterSpacing: '0.08em',
                                                        fontWeight: 700,
                                                        color: 'text.secondary',
                                                        width: '24%',
                                                    }}
                                                >
                                                    Down
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        typography: 'overline',
                                                        letterSpacing: '0.08em',
                                                        fontWeight: 700,
                                                        color: 'text.secondary',
                                                        width: '24%',
                                                    }}
                                                >
                                                    Up
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {network.interfaces.map((iface, index) => (
                                                <TableRow key={`${iface.name}-${index}`} hover>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                                        {iface.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={iface.active ? 'Active' : 'Inactive'}
                                                            size="small"
                                                            color={iface.active ? 'success' : 'default'}
                                                        />
                                                    </TableCell>
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'pre',
                                                        }}
                                                    >
                                                        {formatNetworkRate(iface.downloadSpeed)}
                                                    </TableCell>
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'pre',
                                                        }}
                                                    >
                                                        {formatNetworkRate(iface.uploadSpeed)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
};

export default System;
