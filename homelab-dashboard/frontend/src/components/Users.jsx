// src/components/Users.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Divider,
    Chip,
    Avatar,
    Stack
} from '@mui/material';
import {
    Person as PersonIcon,
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showSuccess, showError, showConfirmDialog } = useNotification();
    const { user: currentUser } = useAuth();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const result = await tryApiCall('/users');
            setUsersList(result.data.users || []);
        } catch (err) {
            showError(`Failed to load users: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDeleteUser = (userToDelete) => {
        showConfirmDialog({
            title: `Delete User`,
            message: `Are you sure you want to permanently delete user "${userToDelete.username}"? This will remove all of their settings, devices, and chats.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    await tryApiCall(`/users/${userToDelete.id}`, {
                        method: 'DELETE'
                    });
                    showSuccess(`User "${userToDelete.username}" deleted successfully`);
                    fetchUsers();
                } catch (err) {
                    showError(`Failed to delete user: ${err.message}`);
                }
            }
        });
    };

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
            <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
                    Users
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Manage user accounts and permissions
                </Typography>
            </Box>

            <Card>
                <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {usersList.length} user{usersList.length !== 1 ? 's' : ''} registered
                    </Typography>
                    <List disablePadding>
                        {usersList.map((u, idx) => (
                            <React.Fragment key={u.id}>
                                {idx > 0 && <Divider component="li" />}
                                <ListItem
                                    secondaryAction={
                                        u.id !== currentUser?.id && (
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={() => handleDeleteUser(u)}
                                            >
                                                Delete
                                            </Button>
                                        )
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: u.groups?.includes('admin') ? 'warning.main' : 'primary.main' }}>
                                            {u.username?.charAt(0).toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                    {u.username}
                                                </Typography>
                                                {u.id === currentUser?.id && (
                                                    <Chip label="You" size="small" color="primary" variant="outlined" />
                                                )}
                                                {u.groups?.includes('admin') && (
                                                    <Chip icon={<AdminIcon />} label="Admin" size="small" color="warning" variant="outlined" />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                                {u.email && (
                                                    <Typography variant="body2" color="text.secondary" component="span">
                                                        {u.email}
                                                    </Typography>
                                                )}
                                                <Chip
                                                    icon={u.is_sso_user ? <SSOIcon /> : <LocalIcon />}
                                                    label={u.is_sso_user ? 'SSO' : 'Local'}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ height: 22 }}
                                                />
                                            </Stack>
                                        }
                                        slotProps={{ secondary: { component: 'div' } }}
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Users;
