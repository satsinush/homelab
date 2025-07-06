// src/components/PackageManager.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Alert,
    CircularProgress,
    Container,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
    Button,
    TextField,
    InputAdornment
} from '@mui/material';
import {
    Inventory as PackageIcon,
    Search as SearchIcon,
    SystemUpdate as UpdateIcon,
    CheckCircle as InstalledIcon,
    Schedule as PendingIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';

const PackageManager = () => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                setError('');
                const result = await tryApiCall('/packages');
                setPackages(result.data);
                setLoading(false);
            } catch (err) {
                setError('Unable to connect to API server - Package management not available');
                setLoading(false);
            }
        };

        fetchPackages();
    }, []);

    const filteredPackages = packages.filter(pkg =>
        pkg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2 }, width: '100%' }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Package Manager
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                    Manage system packages and updates
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Loading package information...
                    </Typography>
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2 }, width: '100%' }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Package Manager
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                    Manage system packages and updates
                </Typography>

                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <PackageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                        Package Management Unavailable
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        {error}
                    </Typography>
                    <Alert severity="info">
                        Package management functionality requires API server connection and appropriate system permissions.
                    </Alert>
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2 }, width: '100%' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Package Manager
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    Manage system packages and updates
                </Typography>

                {/* Search and Stats */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <TextField
                        placeholder="Search packages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 300 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Chip
                            icon={<PackageIcon />}
                            label={`${packages.length} Total Packages`}
                            color="primary"
                            variant="outlined"
                        />
                        <Chip
                            icon={<InstalledIcon />}
                            label={`${packages.filter(p => p.status === 'installed').length} Installed`}
                            color="success"
                            variant="outlined"
                        />
                    </Box>
                </Box>
            </Box>

            {packages.length > 0 ? (
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                Installed Packages
                            </Typography>
                            <Button
                                startIcon={<UpdateIcon />}
                                variant="outlined"
                                color="primary"
                            >
                                Check for Updates
                            </Button>
                        </Box>

                        {filteredPackages.length > 0 ? (
                            <List sx={{ py: 0 }}>
                                {filteredPackages.map((pkg, index) => (
                                    <ListItem
                                        key={index}
                                        sx={{
                                            px: 0,
                                            py: 1,
                                            borderBottom: index < filteredPackages.length - 1 ? '1px solid' : 'none',
                                            borderBottomColor: 'divider'
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            {pkg.status === 'installed' ? (
                                                <InstalledIcon sx={{ color: 'success.main' }} />
                                            ) : (
                                                <PendingIcon sx={{ color: 'warning.main' }} />
                                            )}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                                        {pkg.name}
                                                    </Typography>
                                                    {pkg.version && (
                                                        <Chip
                                                            label={pkg.version}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontFamily: 'monospace' }}
                                                        />
                                                    )}
                                                    <Chip
                                                        label={pkg.status || 'unknown'}
                                                        size="small"
                                                        color={pkg.status === 'installed' ? 'success' : 'default'}
                                                        variant="filled"
                                                    />
                                                </Box>
                                            }
                                            secondary={pkg.description || 'No description available'}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="h6" color="text.secondary">
                                    No packages found matching "{searchTerm}"
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Try adjusting your search terms
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <PackageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                        No Packages Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No package information is available from the server.
                    </Typography>
                </Paper>
            )}

            {/* Info Section */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.50' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    About Package Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    This page displays information about installed system packages. Package management operations
                    require appropriate system permissions and may not be available in all environments.
                    Use this interface to monitor installed software and check for available updates.
                </Typography>
            </Paper>
        </Container>
    );
};

export default PackageManager;
