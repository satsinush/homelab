import React, { useEffect, useState } from 'react';
import {
    Box,
    CircularProgress,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import {
    Memory as MemoryIcon,
    Speed as SpeedIcon,
    Storage as StorageIcon,
    Thermostat as ThermostatIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/useAuth';
import type { SystemDataResponse } from '../../types/api';
import { fetchSystemMetrics } from '../../utils/systemMetrics';
import { useWidgetHref } from './LinkTiles';

export function SystemWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const canSystem = hasPermission('dashboard-system-user');
    const [data, setData] = useState<SystemDataResponse | null>(null);
    const [loading, setLoading] = useState(canSystem);
    const [failed, setFailed] = useState(false);
    const linkProps = useWidgetHref('/system', interactive);

    useEffect(() => {
        if (!canSystem) return;
        let cancelled = false;
        const load = async (force: boolean, initial: boolean) => {
            if (initial) {
                setLoading(true);
                setFailed(false);
            }
            try {
                const next = await fetchSystemMetrics({ force });
                if (!cancelled) {
                    setData(next);
                    setFailed(false);
                }
            } catch {
                if (!cancelled && initial) setFailed(true);
            } finally {
                if (!cancelled && initial) setLoading(false);
            }
        };
        void load(false, true);
        const interval = setInterval(() => void load(true, false), 10_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [canSystem]);

    if (!canSystem) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to system metrics.
            </Typography>
        );
    }
    if (failed) {
        return (
            <Typography variant="body2" color="text.secondary">
                Unable to load system metrics.
            </Typography>
        );
    }
    if (loading || !data?.resources) {
        return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                    Loading…
                </Typography>
            </Stack>
        );
    }

    const barColor = (pct?: number) => {
        if (pct == null) return 'primary' as const;
        if (pct >= 80) return 'error' as const;
        if (pct >= 50) return 'warning' as const;
        return 'success' as const;
    };

    const items: { label: string; value: string; pct?: number; icon: React.ReactNode }[] = [];
    const cpu = data.resources.cpu?.usage;
    const mem = data.resources.memory?.percentage;
    const disk = data.resources.disk?.percentage;
    const temp = data.temperature?.cpu;
    if (cpu != null && Number.isFinite(cpu)) {
        items.push({ label: 'CPU', value: `${Math.round(cpu)}%`, pct: cpu, icon: <SpeedIcon sx={{ fontSize: 16 }} /> });
    }
    if (mem != null && Number.isFinite(mem)) {
        items.push({
            label: 'Mem',
            value: `${Math.round(mem)}%`,
            pct: mem,
            icon: <MemoryIcon sx={{ fontSize: 16 }} />,
        });
    }
    if (disk != null && Number.isFinite(disk)) {
        items.push({
            label: 'Disk',
            value: `${Math.round(disk)}%`,
            pct: disk,
            icon: <StorageIcon sx={{ fontSize: 16 }} />,
        });
    }
    if (temp != null && Number.isFinite(temp)) {
        items.push({
            label: 'Temp',
            value: `${Math.round(temp)}°C`,
            icon: <ThermostatIcon sx={{ fontSize: 16 }} />,
        });
    }

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive ? 'pointer' : 'default',
                width: '100%',
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    alignContent: 'stretch',
                    alignItems: 'stretch',
                }}
            >
                {items.map((item) => (
                    <Box
                        key={item.label}
                        sx={{
                            flex: '1 1 140px',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: 0.75,
                        }}
                    >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ color: 'text.secondary', display: 'flex' }}>{item.icon}</Box>
                            <Typography variant="caption" color="text.secondary">
                                {item.label}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{ fontWeight: 700, ml: 'auto', fontVariantNumeric: 'tabular-nums' }}
                            >
                                {item.value}
                            </Typography>
                        </Stack>
                        {item.pct != null && (
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, Math.max(0, item.pct))}
                                color={barColor(item.pct)}
                                sx={{ height: 6, borderRadius: 1, flexShrink: 0, width: '100%' }}
                            />
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
