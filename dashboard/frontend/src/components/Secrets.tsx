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
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tooltip
} from '@mui/material';
import {
    ContentCopy as CopyIcon,
    Visibility as ShowIcon,
    VisibilityOff as HideIcon,
    Search as SearchIcon,
    VpnKey as KeyIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { SecretsResponse } from '../types/api';

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
            <Container maxWidth={false} sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <KeyIcon color="primary" sx={{ fontSize: '2.5rem' }} />
                        System Secrets
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        View secrets and public configs (Admin Only)
                    </Typography>
                </Box>
                <Button variant="outlined" color="primary" onClick={fetchSecrets}>
                    Refresh
                </Button>
            </Box>

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
                <CardContent sx={{ p: 0 }}>
                    <TableContainer component={Paper} elevation={0} sx={{ maxHeight: '550px', overflowY: 'auto' }}>
                        <Table stickyHeader sx={{ tableLayout: 'fixed' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, width: '30%' }}>Secret Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, width: '55%' }}>Value</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, pr: 3, width: '15%' }}>Actions</TableCell>
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
                                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sec.name}
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{
                                                        fontFamily: 'monospace',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        width: '100%'
                                                    }}>
                                                        {isVisible ? sec.value : '••••••••••••••••••••••••••••••••'}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ pr: 2, whiteSpace: 'nowrap' }}>
                                                    <Tooltip title={isVisible ? "Hide value" : "Show value"}>
                                                        <IconButton onClick={() => handleToggleVisibility(sec.name)} size="small" sx={{ mr: 1 }}>
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
                    </TableContainer>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Secrets;
