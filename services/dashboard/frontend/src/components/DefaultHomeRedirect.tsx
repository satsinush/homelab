import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { tryApiCall } from '../utils/api';
import { resolveDefaultHome } from '../utils/navPages';
import { useAuth } from '../contexts/useAuth';
import { UserSettings } from '../types/api';

/**
 * `/` landing: send the user to their saved default page.
 * If that page is admin-only (or otherwise forbidden), reset setting to Home.
 */
const DefaultHomeRedirect = () => {
    const { hasPermission, user } = useAuth();
    const [target, setTarget] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            let settings: UserSettings = {};
            try {
                const res = await tryApiCall<{ settings: UserSettings }>('/user-settings');
                settings = res.data?.settings || {};
            } catch {
                if (!cancelled) setTarget('/home');
                return;
            }

            const { path, reset } = resolveDefaultHome(
                typeof settings.defaultHomePage === 'string' ? settings.defaultHomePage : 'home',
                hasPermission
            );

            if (reset) {
                try {
                    await tryApiCall('/user-settings', {
                        method: 'PUT',
                        data: { ...settings, defaultHomePage: 'home' },
                    });
                } catch {
                    /* still navigate home */
                }
            }

            if (!cancelled) setTarget(path);
        };

        void run();
        return () => {
            cancelled = true;
        };
        // Re-run when roles change (e.g. admin demotion), not on every hasPermission identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hasPermission closes over user.roles
    }, [user?.roles]);

    if (!target) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    minHeight: 200,
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

    return <Navigate to={target} replace />;
};

export default DefaultHomeRedirect;
