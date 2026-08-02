import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { HomeWidgetType } from './widgets';

/** Miniature non-interactive mock of a widget for the Add-widget picker. */
export function WidgetTypePreview({ type }: { type: HomeWidgetType }) {
    return (
        <Box
            sx={{
                height: 88,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        >
            <Box
                sx={{
                    px: 1,
                    py: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: 'text.disabled' }} />
                <Box sx={{ height: 6, width: 48, borderRadius: 0.5, bgcolor: 'text.disabled', opacity: 0.7 }} />
            </Box>
            <Box sx={{ flex: 1, p: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>{previewBody(type)}</Box>
        </Box>
    );
}

function previewBody(type: HomeWidgetType): React.ReactNode {
    switch (type) {
        case 'system':
            return (
                <Stack spacing={0.75} sx={{ width: '100%' }}>
                    {['CPU', 'Mem', 'Disk'].map((label, i) => (
                        <Box key={label}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1 }}>
                                    {label}
                                </Typography>
                                <Typography sx={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                                    {[42, 67, 31][i]}%
                                </Typography>
                            </Stack>
                            <Box sx={{ height: 3, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: `${[42, 67, 31][i]}%`,
                                        bgcolor: i === 1 ? 'warning.main' : 'success.main',
                                    }}
                                />
                            </Box>
                        </Box>
                    ))}
                </Stack>
            );
        case 'packages':
            return (
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'warning.main', lineHeight: 1.2 }}>
                    3 available
                </Typography>
            );
        case 'gatus':
            return (
                <Stack direction="row" spacing={2} alignItems="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>12</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>↑</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>1</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>↓</Typography>
                    </Stack>
                </Stack>
            );
        case 'devices':
            return (
                <Box>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                        <Box component="span" sx={{ color: 'success.main' }}>
                            12
                        </Box>
                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {' '}
                            / 28
                        </Box>
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>online</Typography>
                </Box>
            );
        case 'clock':
            return (
                <Box>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        3:42
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>Sat, Aug 1</Typography>
                </Box>
            );
        case 'wake':
            return (
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="center" sx={{ width: '100%' }}>
                    {['NAS', 'PC', 'TV'].map((name) => (
                        <Box
                            key={name}
                            sx={{
                                px: 1,
                                py: 0.4,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                fontSize: 10,
                                fontWeight: 600,
                            }}
                        >
                            {name}
                        </Box>
                    ))}
                </Stack>
            );
        case 'recents':
            return (
                <Stack direction="row" spacing={0.75} sx={{ width: '100%', overflow: 'hidden' }}>
                    {['Home', 'System', 'Chat'].map((t) => (
                        <Box
                            key={t}
                            sx={{
                                flex: '0 0 auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 0.75,
                                py: 0.5,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                minWidth: 64,
                            }}
                        >
                            <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: 'primary.main', opacity: 0.7 }} />
                            <Typography noWrap sx={{ fontSize: 10, fontWeight: 600 }}>
                                {t}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            );
        case 'pages':
        case 'services':
        case 'links':
            return (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 0.75,
                        width: '100%',
                    }}
                >
                    {Array.from({ length: 3 }, (_, i) => (
                        <Box
                            key={i}
                            sx={{
                                aspectRatio: '1',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.35,
                                p: 0.35,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: type === 'links' ? '50%' : 0.75,
                                    bgcolor: type === 'services' ? 'info.main' : 'primary.main',
                                    opacity: 0.65,
                                }}
                            />
                            <Box sx={{ height: 4, width: '70%', borderRadius: 0.5, bgcolor: 'text.disabled', opacity: 0.5 }} />
                        </Box>
                    ))}
                </Box>
            );
        default:
            return null;
    }
}
