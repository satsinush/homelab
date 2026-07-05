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
    TableContainer,
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
    Paper
} from '@mui/material';
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';

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

            // Show notes from the backend
            if (result.data.note) {
                console.log('Package status:', result.data.note);
            }
        } catch (err) {
            const error = err as Error;
            showError(error.message || 'Unable to fetch package information - Package management not available');
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
        // Filter by package name search term
        const matchesPackageSearch = pkg.name?.toLowerCase().includes(searchTerm.toLowerCase());

        // Filter by version search term
        const packageVersion = pkg.hasUpdate ? `${pkg.currentVersion} → ${pkg.newVersion}` : pkg.currentVersion;
        const matchesVersionSearch = packageVersion?.toLowerCase().includes(versionSearchTerm.toLowerCase());

        // Filter by status
        let matchesFilter = true;
        if (filterStatus === 'updates') {
            matchesFilter = pkg.hasUpdate === true;
        } else if (filterStatus === 'uptodate') {
            matchesFilter = pkg.hasUpdate === false;
        }

        return matchesPackageSearch && matchesVersionSearch && matchesFilter;
    }).sort((a, b) => {
        // Sort by update status first (updates available at top)
        if (a.hasUpdate && !b.hasUpdate) return -1;
        if (!a.hasUpdate && b.hasUpdate) return 1;

        // Then sort alphabetically by package name
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
        } else {
            return (
                <Chip
                    label="Up to Date"
                    size="small"
                    color="success"
                    variant="outlined"
                />
            );
        }
    };

    const getVersionDisplay = (pkg: SystemPackage) => {
        if (pkg.hasUpdate) {
            return `${pkg.currentVersion} → ${pkg.newVersion}`;
        } else {
            return pkg.currentVersion;
        }
    };

    const getStatsForFilter = (filter: string) => {
        if (filter === 'updates') return packages.filter(pkg => pkg.hasUpdate).length;
        if (filter === 'uptodate') return packages.filter(pkg => !pkg.hasUpdate).length;
        return packages.length;
    };

    const formatSyncTime = (syncTime: string | null) => {
        if (!syncTime) return 'Unknown';

        const date = new Date(syncTime);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
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
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Package Manager
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    Manage Arch Linux packages with update information
                </Typography>

                {/* Stats and Sync Info */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="body1" color="text.secondary">
                            {packages.length > 0 && `Total: ${packages.length} packages, ${packages.filter(pkg => pkg.hasUpdate).length} updates available`}
                        </Typography>
                        {lastSynced && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Package database last synced: {formatSyncTime(lastSynced)}
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<RefreshIcon />}
                            onClick={fetchPackages}
                        >
                            Sync Database
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Filter controls */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
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
                            sx={{ flexGrow: 1, minWidth: '200px' }}
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
                            sx={{ flexGrow: 1, minWidth: '200px' }}
                        />

                        <FormControl size="small" sx={{ minWidth: '180px' }}>
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

            {/* Packages Table */}
            <Card>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Package Name</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Installed Version</TableCell>
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
                                filteredPackages.map((pkg) => (
                                    <TableRow key={pkg.name}>
                                        <TableCell sx={{ fontWeight: 500 }}>{pkg.name}</TableCell>
                                        <TableCell>{getUpdateStatusChip(pkg)}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>
                                            {getVersionDisplay(pkg)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>
        </Container>
    );
};

export default PackageManager;
