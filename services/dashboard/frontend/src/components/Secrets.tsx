// src/components/Secrets.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    Button,
    IconButton,
    InputAdornment,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Stack,
    Divider,
    useMediaQuery,
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    ContentCopy as CopyIcon,
    Visibility as ShowIcon,
    VisibilityOff as HideIcon,
    Search as SearchIcon,
    VpnKey as KeyIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { SecretsResponse } from '../types/api';
import ScrollContainer from './ScrollContainer';

import { getErrorMessage } from '../utils/errors';

interface SecretItem {
    name: string;
    value: string;
    description?: string;
}

const Secrets = () => {
    const [secrets, setSecrets] = useState<SecretItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
    const [popupSecret, setPopupSecret] = useState<SecretItem | null>(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const { showSuccess, showError } = useNotification();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const fetchSecrets = useCallback(async () => {
        setLoading(true);
        try {
            const result = await tryApiCall<SecretsResponse>('/system/secrets');
            setSecrets((result.data.secrets || []).map(s => ({
                name: s.name,
                value: s.value,
                description: s.description
            })));
        } catch (err) {
            showError(`Failed to load secrets: ${getErrorMessage(err)}`);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchSecrets();
    }, [fetchSecrets]);

    const handleToggleVisibility = (name: string) => {
        setVisibleSecrets(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const handleCopyToClipboard = (value: string, name: string) => {
        navigator.clipboard.writeText(value);
        showSuccess(`Copied value for secret "${name}" to clipboard`);
    };

    const handleOpenPopup = (sec: SecretItem) => {
        setPopupSecret(sec);
        setPopupVisible(true);
    };

    const filteredSecrets = secrets
        .filter(sec => (sec.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }));

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
            <PageHeader
                title="Secrets"
                icon={<KeyIcon />}
                actions={
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={fetchSecrets}
                    >
                        Refresh
                    </Button>
                }
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Homelab secret values from <Box component="span" sx={{ fontFamily: 'monospace' }}>volumes/secrets</Box>.
                Reveal or copy as needed — treat these as credentials.
            </Typography>

            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search secrets by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }
                    }}
                />
            </Box>

            <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <ScrollContainer maxHeight="min(75dvh, 600px)" vertical>
                        {filteredSecrets.length === 0 ? (
                            <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
                                <Typography variant="body1" color="text.secondary">
                                    No secrets found matching query
                                </Typography>
                            </Box>
                        ) : (
                            <Stack divider={<Divider />} sx={{ px: { xs: 2, sm: 3 } }}>
                                {filteredSecrets.map((sec, index) => (
                                    <Box
                                        key={sec.name || index}
                                        sx={{
                                            py: 1.75,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 2,
                                            '&:hover': { bgcolor: 'action.hover' },
                                            px: 1,
                                            borderRadius: 1.5,
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontWeight: 600,
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word',
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            {sec.name}
                                        </Typography>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<ShowIcon fontSize="small" />}
                                                onClick={() => handleOpenPopup(sec)}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                View
                                            </Button>
                                            <Tooltip title="Copy value to clipboard">
                                                <IconButton
                                                    onClick={() => handleCopyToClipboard(sec.value, sec.name)}
                                                    size="small"
                                                    color="primary"
                                                >
                                                    <CopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </ScrollContainer>
                </CardContent>
            </Card>

            {/* Secret Detail Popup Dialog */}
            <Dialog
                open={popupVisible}
                onClose={() => setPopupVisible(false)}
                disableRestoreFocus
                maxWidth="sm"
                fullWidth
            >
                {popupSecret && (
                    <>
                        <DialogTitle sx={{ fontFamily: 'monospace', fontWeight: 700, pr: 6, wordBreak: 'break-word' }}>
                            {popupSecret.name}
                        </DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Secret Value
                            </Typography>
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: 'action.hover',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    whiteSpace: visibleSecrets[popupSecret.name] ? 'pre-wrap' : 'nowrap',
                                    overflowX: 'auto',
                                    userSelect: 'all',
                                }}
                            >
                                {visibleSecrets[popupSecret.name] ? popupSecret.value : '••••••••••••'}
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
                            <Button
                                startIcon={visibleSecrets[popupSecret.name] ? <HideIcon /> : <ShowIcon />}
                                onClick={() => handleToggleVisibility(popupSecret.name)}
                                color="inherit"
                            >
                                {visibleSecrets[popupSecret.name] ? 'Hide' : 'Reveal'}
                            </Button>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    startIcon={<CopyIcon />}
                                    onClick={() => handleCopyToClipboard(popupSecret.value, popupSecret.name)}
                                >
                                    Copy
                                </Button>
                                <Button onClick={() => setPopupVisible(false)}>
                                    Close
                                </Button>
                            </Box>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Container>
    );
};

export default Secrets;
