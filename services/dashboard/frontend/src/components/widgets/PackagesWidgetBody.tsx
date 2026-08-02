import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '../../contexts/useAuth';
import { tryApiCall } from '../../utils/api';
import { useWidgetHref } from './LinkTiles';

export function PackagesWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const can = hasPermission('dashboard-packages-user');
    const [loading, setLoading] = useState(can);
    const [count, setCount] = useState<number | null>(null);
    const linkProps = useWidgetHref('/packages', interactive);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ updatesAvailable: number }>('/packages/summary');
                if (!cancelled) setCount(res.data?.updatesAvailable ?? 0);
            } catch {
                if (!cancelled) setCount(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [can]);

    if (!can) {
        return (
            <Typography variant="body2" color="text.secondary">
                No access to packages.
            </Typography>
        );
    }

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
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 700,
                        color: count == null ? 'text.secondary' : count > 0 ? 'warning.main' : 'success.main',
                    }}
                >
                    {count == null ? 'Unavailable' : count > 0 ? `${count} available` : 'Up to date'}
                </Typography>
            )}
        </Box>
    );
}
