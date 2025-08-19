// src/components/PackageManager.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    Paper,
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
    InputLabel
} from '@mui/material';
import {
    Inventory as PackageIcon,
    Search as SearchIcon,
    Schedule as PendingIcon,
    Refresh as RefreshIcon,
    CheckCircle as InstalledIcon,
    FilterList as FilterIcon,
    Notifications as NotificationIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const PackageManager = () => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [versionSearchTerm, setVersionSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'updates', 'uptodate'
    const [lastSynced, setLastSynced] = useState(null);
    const { showError, showSuccess } = useNotification();

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const result = await tryApiCall('/packages', { 'timeout': 30000 });
            setPackages(result.data.packages || []);
            setLastSynced(result.data.lastSynced);

            // Show any notes from the backend
            if (result.note) {
                console.log('Package status:', result.note);
            }
        } catch (err) {
            // Use the specific error message from the API, fallback to generic message
            showError(err.message || 'Unable to fetch package information - Package management not available');
            setPackages([]);
            setLastSynced(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, [showError, showSuccess]);

    // Generate dynamic filter options
    const getUniqueStatusValues = () => {
        const statusValues = packages.map(pkg => {
            return pkg.hasUpdate ? 'updates' : 'uptodate';
        });
        return [...new Set(statusValues)].sort();
    };

    const statusOptions = getUniqueStatusValues();

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

    const getUpdateStatusChip = (pkg) => {
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

    const getVersionDisplay = (pkg) => {
        if (pkg.hasUpdate) {
            return `${pkg.currentVersion} → ${pkg.newVersion}`;
        } else {
            return pkg.currentVersion;
        }
    };

    const getStatsForFilter = (filter) => {
        if (filter === 'updates') return packages.filter(pkg => pkg.hasUpdate).length;
        if (filter === 'uptodate') return packages.filter(pkg => !pkg.hasUpdate).length;
        return packages.length;
    };

    const formatSyncTime = (syncTime) => {
        if (!syncTime) return 'Unknown';

        const date = new Date(syncTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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
                            startIcon={<RefreshIcon />}
                            variant="outlined"
                            onClick={fetchPackages}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Box>

            <Card>
                <CardContent>
                    <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, pb: 1, width: '50%', bgcolor: 'background.paper' }}>
                                        Package
                                        <TextField
                                            placeholder="Search packages..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            size="small"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon fontSize="small" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{ mt: 1, width: '100%' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, width: '25%', pb: 1, bgcolor: 'background.paper' }}>
                                        Version
                                        <TextField
                                            placeholder="Search versions..."
                                            value={versionSearchTerm}
                                            onChange={(e) => setVersionSearchTerm(e.target.value)}
                                            size="small"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon fontSize="small" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{ mt: 1, width: '100%' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, pb: 1, width: '25%', bgcolor: 'background.paper' }}>
                                        Update Status
                                        <FormControl size="small" sx={{ mt: 1, width: '100%' }}>
                                            <Select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                displayEmpty
                                            >
                                                <MenuItem value="all">All Packages</MenuItem>
                                                {statusOptions.includes('updates') && (
                                                    <MenuItem value="updates">Updates Available</MenuItem>
                                                )}
                                                {statusOptions.includes('uptodate') && (
                                                    <MenuItem value="uptodate">Up to Date</MenuItem>
                                                )}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredPackages.map((pkg) => (
                                    <TableRow
                                        key={pkg.name}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell sx={{ width: '50%' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                                {pkg.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ width: '25%' }}>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontFamily: 'monospace',
                                                    color: pkg.hasUpdate ? 'warning.main' : 'text.primary'
                                                }}
                                            >
                                                {getVersionDisplay(pkg)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ width: '25%' }}>
                                            {getUpdateStatusChip(pkg)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredPackages.length === 0 && packages.length > 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4 }}>
                                            <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                            <Typography variant="h6" color="text.secondary">
                                                No Matching Packages
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                No packages found matching your search and filter criteria.
                                            </Typography>
                                            <Button
                                                sx={{ mt: 2 }}
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setVersionSearchTerm('');
                                                    setFilterStatus('all');
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            {packages.length === 0 && !loading && (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'action.selected', mt: 3 }}>
                    <PackageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                        No Packages Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No packages found or package management not available.
                    </Typography>
                </Paper>
            )}

            {/* Info Section */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.50' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About Package Management
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    This interface shows all explicitly installed Arch Linux packages with update information.
                    Package database is automatically synced each day.
                    {lastSynced && (
                        <span> Last sync: {formatSyncTime(lastSynced)}.</span>
                    )}
                </Typography>


                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                    To upgrade packages:
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                    Run upgrades manually via SSH:
                    <br />
                    <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px' }}>
                        sudo pacman -Syu
                    </code>
                    <br />
                    Or upgrade specific packages:
                    <br />
                    <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px' }}>
                        sudo pacman -S package-name
                    </code>
                </Typography>
            </Paper>
        </Container>
    );
};

export default PackageManager;
