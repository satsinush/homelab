import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { PowerSettingsNew as PowerIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/useAuth';
import { useNotification } from '../../contexts/useNotification';
import type { Device } from '../../types/api';
import { tryApiCall } from '../../utils/api';
import { getErrorMessage } from '../../utils/errors';
import { formatDevicesForDisplay } from '../../utils/formatters';

export function WakeWidgetBody({ interactive = true }: { interactive?: boolean }) {
    const { hasPermission } = useAuth();
    const { showSuccess, showError } = useNotification();
    const can = hasPermission('dashboard-devices-user');
    const [loading, setLoading] = useState(can);
    const [favorites, setFavorites] = useState<Device[]>([]);
    const [wakingMac, setWakingMac] = useState<string | null>(null);

    useEffect(() => {
        if (!can) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await tryApiCall<{ devices: Device[] }>('/devices/favorites');
                if (!cancelled) setFavorites(formatDevicesForDisplay(res.data?.devices || []));
            } catch {
                if (!cancelled) setFavorites([]);
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
            <Typography variant="body2" color="text.secondary" textAlign="center">
                No access to devices.
            </Typography>
        );
    }
    if (loading) {
        return (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <CircularProgress size={14} />
                <Typography variant="body2" color="text.secondary">
                    Loading favorites…
                </Typography>
            </Stack>
        );
    }
    if (favorites.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" textAlign="center">
                No favorite devices yet. Star devices on the Devices page.
            </Typography>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignContent: 'center',
                gap: 1.5,
            }}
        >
            <Stack
                direction="row"
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
                justifyContent="center"
                alignItems="center"
            >
                {favorites.map((device) => {
                    const key = device.macNormalized || device.mac || device.name || '';
                    const waking = wakingMac === key;
                    return (
                        <Button
                            key={key}
                            size="medium"
                            variant="outlined"
                            startIcon={
                                waking ? <CircularProgress size={18} color="inherit" /> : <PowerIcon />
                            }
                            disabled={!interactive || waking}
                            sx={{ px: 2.5, py: 1.25, minHeight: 48, fontWeight: 600 }}
                            onClick={async () => {
                                if (!interactive) return;
                                setWakingMac(key);
                                try {
                                    await tryApiCall('/wol', {
                                        method: 'POST',
                                        data: { device },
                                        timeout: 10000,
                                    });
                                    showSuccess(`Wake-on-LAN sent to ${device.name || device.mac}`);
                                } catch (err) {
                                    showError(getErrorMessage(err) || 'Failed to send Wake-on-LAN');
                                } finally {
                                    setWakingMac(null);
                                }
                            }}
                        >
                            {device.name || device.mac}
                        </Button>
                    );
                })}
            </Stack>
        </Box>
    );
}
