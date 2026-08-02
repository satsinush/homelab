import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { ArrowDownward as ArrowDownIcon, ArrowUpward as ArrowUpIcon } from '@mui/icons-material';
import { useConfig } from '../../contexts/useConfig';
import { tryApiCall } from '../../utils/api';
import { useWidgetHref } from './LinkTiles';

export function GatusWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { config } = useConfig();
    const [loading, setLoading] = useState(true);
    const [gatus, setGatus] = useState<{ up: number; down: number; total: number } | null>(null);
    const url = config.hostnames?.gatus ? `https://${config.hostnames.gatus}` : null;
    const linkProps = useWidgetHref(url, interactive);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await tryApiCall<{ up: number; down: number; total: number }>('/gatus/summary');
                if (!cancelled && res.data) {
                    setGatus({
                        up: res.data.up ?? 0,
                        down: res.data.down ?? 0,
                        total: res.data.total ?? 0,
                    });
                }
            } catch {
                if (!cancelled) setGatus(null);
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
    }, []);

    return (
        <Box
            {...linkProps}
            sx={{
                cursor: interactive && url ? 'pointer' : 'default',
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
            ) : !gatus ? (
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Unavailable
                </Typography>
            ) : gatus.up === 0 && gatus.down === 0 ? (
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    None
                </Typography>
            ) : (
                <Stack direction="row" spacing={2.5} alignItems="center">
                    {gatus.up > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {gatus.up}
                            </Typography>
                            <ArrowUpIcon fontSize="small" />
                        </Stack>
                    )}
                    {gatus.down > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {gatus.down}
                            </Typography>
                            <ArrowDownIcon fontSize="small" />
                        </Stack>
                    )}
                </Stack>
            )}
        </Box>
    );
}
