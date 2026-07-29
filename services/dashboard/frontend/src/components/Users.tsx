// src/components/Users.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Container,
    List,
    ListItem,
    Divider,
    Chip,
    Avatar,
    Stack,
    Alert,
    AlertTitle
} from '@mui/material';
import {
    Shield as AdminIcon,
    Cloud as SSOIcon,
    Computer as LocalIcon,
    People as PeopleIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import { useAuth } from '../contexts/useAuth';
import { useConfig } from '../contexts/useConfig';

import { getErrorMessage } from '../utils/errors';

interface UserListItem {
    id: number;
    username: string;
    email?: string;
    roles: string[];
    groups: string[];
    sso_id?: string;
    has_local_password?: boolean;
}

const Users = () => {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { showError } = useNotification();
    const { user: currentUser } = useAuth();
    const { config } = useConfig();
    const authHost = config.hostnames?.authentik || `auth.${config.homelabHostname || 'homelab.home.arpa'}`;

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await tryApiCall<{ users: UserListItem[] }>('/users');
            setUsers(data.data.users || []);
        } catch (e: unknown) {
            showError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            <PageHeader title="Users" icon={<PeopleIcon />} />
            <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Identity is managed in Authentik</AlertTitle>
                Create users, reset passwords, and assign groups in{' '}
                <a href={`https://${authHost}`} target="_blank" rel="noreferrer">
                    Authentik
                </a>
                . Samba/mail use that identity (LDAP); Nextcloud/Immich use OIDC.
            </Alert>
            <Card>
                <CardContent>
                    <List disablePadding>
                        {users.map((u, i) => (
                            <React.Fragment key={u.id}>
                                {i > 0 && <Divider />}
                                <ListItem sx={{ py: 1.5, gap: 2 }}>
                                    <Avatar>{u.username.slice(0, 1).toUpperCase()}</Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography fontWeight={600}>{u.username}</Typography>
                                        {u.email && (
                                            <Typography variant="body2" color="text.secondary">
                                                {u.email}
                                            </Typography>
                                        )}
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                            {u.roles?.includes('homelab-admin') && (
                                                <Chip size="small" icon={<AdminIcon />} label="Admin" color="primary" />
                                            )}
                                            {u.sso_id ? (
                                                <Chip size="small" icon={<SSOIcon />} label="SSO" />
                                            ) : (
                                                <Chip size="small" icon={<LocalIcon />} label="Local" />
                                            )}
                                            {u.id === currentUser?.id && <Chip size="small" label="You" />}
                                        </Stack>
                                    </Box>
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
