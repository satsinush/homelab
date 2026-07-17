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
    useTheme
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

            <Card>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {isMobile ? (
                        <ScrollContainer maxHeight="min(70dvh, 560px)" vertical>
                            {filteredSecrets.length === 0 ? (
                                <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No secrets found matching query
                                    </Typography>
                                </Box>
                            ) : (
                                <Stack divider={<Divider />} sx={{ px: 2 }}>
                                    {filteredSecrets.map((sec, index) => {
                                        const isVisible = !!visibleSecrets[sec.name];
                                        return (
                                            <Box key={sec.name || index} sx={{ py: 2 }}>
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{
                                                        fontFamily: 'monospace',
                                                        fontWeight: 600,
                                                        overflowWrap: 'anywhere',
                                                        wordBreak: 'break-word',
                                                        mb: 1
                                                    }}
                                                >
                                                    {sec.name}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.875rem',
                                                        overflowWrap: 'anywhere',
                                                        wordBreak: 'break-word',
                                                        whiteSpace: isVisible ? 'pre-wrap' : 'nowrap',
                                                        overflowX: isVisible ? 'visible' : 'auto',
                                                        mb: 1.5,
                                                        color: 'text.secondary'
                                                    }}
                                                >
                                                    {isVisible ? sec.value : '••••••••••••••••••••••••••••••••'}
                                                </Box>
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Tooltip title={isVisible ? 'Hide value' : 'Show value'}>
                                                        <IconButton onClick={() => handleToggleVisibility(sec.name)} size="small">
                                                            {isVisible ? <HideIcon /> : <ShowIcon />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Copy to clipboard">
                                                        <IconButton
                                                            onClick={() => handleCopyToClipboard(sec.value, sec.name)}
                                                            size="small"
                                                            color="primary"
                                                        >
                                                            <CopyIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                        </ScrollContainer>
                    ) : (
                        <ScrollContainer
                            contentMinWidth={720}
                            maxHeight="min(70dvh, 550px)"
                            vertical
                        >
                            <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, width: '35%' }}>Secret Name</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 'calc(65% - 104px)' }}>Value</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, width: 104, pr: 2 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredSecrets.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body1" color="text.secondary">
                                                    No secrets found matching query
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSecrets.map((sec, index) => {
                                            const isVisible = !!visibleSecrets[sec.name];
                                            return (
                                                <TableRow key={sec.name || index} hover>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                                        <Box
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                fontWeight: 500,
                                                                overflowWrap: 'anywhere',
                                                                wordBreak: 'break-word',
                                                                whiteSpace: 'normal'
                                                            }}
                                                        >
                                                            {sec.name}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', minWidth: 0 }}>
                                                        <Box
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                overflowWrap: isVisible ? 'anywhere' : 'normal',
                                                                wordBreak: isVisible ? 'break-word' : 'normal',
                                                                whiteSpace: isVisible ? 'pre-wrap' : 'nowrap',
                                                                overflow: isVisible ? 'visible' : 'hidden',
                                                                textOverflow: isVisible ? 'clip' : 'ellipsis',
                                                                maxWidth: '100%'
                                                            }}
                                                        >
                                                            {isVisible ? sec.value : '••••••••••••••••••••••••••••••••'}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ pr: 1, whiteSpace: 'nowrap', width: 104 }}>
                                                        <Tooltip title={isVisible ? 'Hide value' : 'Show value'}>
                                                            <IconButton onClick={() => handleToggleVisibility(sec.name)} size="small" sx={{ mr: 0.5 }}>
                                                                {isVisible ? <HideIcon /> : <ShowIcon />}
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Copy to clipboard">
                                                            <IconButton onClick={() => handleCopyToClipboard(sec.value, sec.name)} size="small" color="primary">
                                                                <CopyIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollContainer>
                    )}
                </CardContent>
            </Card>
        </Container>
    );
};

export default Secrets;
