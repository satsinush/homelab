import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '../../contexts/useAuth';
import { tryApiCall } from '../../utils/api';
import { useWidgetHref } from './LinkTiles';

export function DevicesWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const can = hasPermission('dashboard-devices-user');
    const [loading, setLoading] = useState(can);
    const [counts, setCounts] = useState<{ online: number; total: number } | null>(null);
    const linkProps = useWidgetHref('/devices', interactive);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        const load = async () => {
            try {
                const res = await tryApiCall<{ onlineDevices: number; totalDevices: number }>('/devices');
                if (!cancelled) {
                    setCounts({
                        online: res.data?.onlineDevices ?? 0,
                        total: res.data?.totalDevices ?? 0,
                    });
                }
            } catch {
                if (!cancelled) setCounts({ online: 0, total: 0 });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        const interval = setInterval(() => void load(), 30_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [can]);

    if (!can) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to devices.
            </Typography>
        );
    }

    const online = counts?.online ?? 0;
    const total = counts?.total ?? 0;
    const allOnline = total > 0 && online === total;
    const noneOnline = online === 0;

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive ? 'pointer' : 'default',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textDecoration: 'none',
                color: 'inherit',
                '&:hover, &:focus, &:visited, &:active': {
                    color: 'inherit',
                    textDecoration: 'none',
                    opacity: 1,
                },
            }}
        >
            {loading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="body2" color="text.secondary">
                        Loading…
                    </Typography>
                </Stack>
            ) : (
                <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                            color: noneOnline ? 'text.secondary' : 'success.main',
                        }}
                    >
                        {online}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                        online
                    </Typography>
                </Stack>
            )}
        </Box>
    );
}
