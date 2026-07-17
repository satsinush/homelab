// src/components/PackageManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    Button,
    TextField,
    InputAdornment,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
    Inventory as InventoryIcon,
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import ScrollContainer from './ScrollContainer';

import { getErrorMessage } from '../utils/errors';

interface SystemPackage {
    name: string;
    hasUpdate: boolean;
    currentVersion: string;
    newVersion?: string;
}

interface PackagesResponse {
    packages: SystemPackage[];
    lastSynced: string | null;
    note?: string;
}

const PackageManager = () => {
    const [packages, setPackages] = useState<SystemPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [versionSearchTerm, setVersionSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'updates', 'uptodate'
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const { showError } = useNotification();

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        try {
            const result = await tryApiCall<PackagesResponse>('/packages', { 'timeout': 30000 });
            setPackages(result.data.packages || []);
            setLastSynced(result.data.lastSynced);

            if (result.data.note) {
                console.log('Package status:', result.data.note);
            }
        } catch (err) {
            showError(getErrorMessage(err) || 'Unable to fetch package information - Package management not available');
            setPackages([]);
            setLastSynced(null);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchPackages();
    }, [fetchPackages]);

    const filteredPackages = packages.filter(pkg => {
        const matchesPackageSearch = pkg.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const packageVersion = pkg.hasUpdate ? `${pkg.currentVersion} → ${pkg.newVersion}` : pkg.currentVersion;
        const matchesVersionSearch = packageVersion?.toLowerCase().includes(versionSearchTerm.toLowerCase());

        let matchesFilter = true;
        if (filterStatus === 'updates') {
            matchesFilter = pkg.hasUpdate === true;
        } else if (filterStatus === 'uptodate') {
            matchesFilter = pkg.hasUpdate === false;
        }

        return matchesPackageSearch && matchesVersionSearch && matchesFilter;
    }).sort((a, b) => {
        if (a.hasUpdate && !b.hasUpdate) return -1;
        if (!a.hasUpdate && b.hasUpdate) return 1;
        return a.name.localeCompare(b.name);
    });

    const getUpdateStatusChip = (pkg: SystemPackage) => {
        if (pkg.hasUpdate) {
            return (
                <Chip
                    label="Update Available"
                    size="small"
                    color="warning"
                    variant="filled"
                />
            );
        }
        return (
            <Chip
                label="Up to Date"
                size="small"
                color="success"
                variant="outlined"
            />
        );
    };

    const getVersionDisplay = (pkg: SystemPackage) => {
        if (pkg.hasUpdate) {
            return `${pkg.currentVersion} → ${pkg.newVersion}`;
        }
        return pkg.currentVersion;
    };

    const getStatsForFilter = (filter: string) => {
        if (filter === 'updates') return packages.filter(pkg => pkg.hasUpdate).length;
        if (filter === 'uptodate') return packages.filter(pkg => !pkg.hasUpdate).length;
        return packages.length;
    };

    const formatSyncTime = (syncTime: string | null) => {
        if (!syncTime) return 'Unknown';
        return new Date(syncTime).toLocaleString();
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: { xs: 2, md: 3 }, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: '100%' }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'calc(100vh - 200px)',
                    py: 8
                }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading package information...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: { xs: 2, md: 3 }, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: '100%' }}>
            <Box sx={{ mb: { xs: 2, md: 3 } }}>
                <PageHeader title="Packages" icon={<InventoryIcon />} />

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    mb: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                    flexWrap: 'wrap',
                    gap: 1.5
                }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                            {packages.length > 0 && `Total: ${packages.length} packages, ${packages.filter(pkg => pkg.hasUpdate).length} updates available`}
                        </Typography>
                        {lastSynced && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Package database last synced: {formatSyncTime(lastSynced)}
                            </Typography>
                        )}
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<RefreshIcon />}
                        onClick={fetchPackages}
                        sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
                    >
                        Sync Database
                    </Button>
                </Box>
            </Box>

            {packages.length === 0 ? (
                <Card sx={{ textAlign: 'center', py: 8 }}>
                    <CardContent>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No packages available
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Package information could not be retrieved. This feature requires a host with package management configured.
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={fetchPackages}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card sx={{ mb: 2 }}>
                        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <TextField
                                    label="Search Packages"
                                    size="small"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon />
                                                </InputAdornment>
                                            )
                                        }
                                    }}
                                    sx={{ flexGrow: 1, width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 } }}
                                />

                                <TextField
                                    label="Search Versions"
                                    size="small"
                                    value={versionSearchTerm}
                                    onChange={(e) => setVersionSearchTerm(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon />
                                                </InputAdornment>
                                            )
                                        }
                                    }}
                                    sx={{ flexGrow: 1, width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 } }}
                                />

                                <FormControl size="small" sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 } }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={filterStatus}
                                        label="Status"
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                    >
                                        <MenuItem value="all">All ({getStatsForFilter('all')})</MenuItem>
                                        <MenuItem value="updates">Updates Available ({getStatsForFilter('updates')})</MenuItem>
                                        <MenuItem value="uptodate">Up to Date ({getStatsForFilter('uptodate')})</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card>
                        <ScrollContainer
                            contentMinWidth={560}
                            maxHeight={{ xs: 'min(60dvh, 480px)', md: 'calc(100vh - 280px)' }}
                            vertical
                        >
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Package Name</TableCell>
                                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Installed Version</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredPackages.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                                                <Typography variant="body1" color="text.secondary">
                                                    No packages found matching search criteria.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPackages.map((pkg) => {
                                            const version = getVersionDisplay(pkg);
                                            return (
                                                <TableRow key={pkg.name}>
                                                    <TableCell sx={{ fontWeight: 500, maxWidth: 220 }}>
                                                        <Tooltip title={pkg.name}>
                                                            <Box sx={{
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {pkg.name}
                                                            </Box>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {getUpdateStatusChip(pkg)}
                                                    </TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace', maxWidth: 280 }}>
                                                        <Tooltip title={version}>
                                                            <Box sx={{
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {version}
                                                            </Box>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollContainer>
                    </Card>
                </>
            )}
        </Container>
    );
};

export default PackageManager;
