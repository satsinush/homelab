// src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

function SlideTransition(props) {
    return <Slide {...props} direction="down" />;
}

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback((message, severity = 'info', duration = 6000) => {
        const id = Date.now() + Math.random();
        const notification = {
            id,
            message,
            severity,
            duration,
            open: true
        };

        setNotifications(prev => [...prev, notification]);

        // Auto-hide notification after duration
        if (duration > 0) {
            setTimeout(() => {
                hideNotification(id);
            }, duration);
        }

        return id;
    }, []);

    const hideNotification = useCallback((id) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === id
                    ? { ...notification, open: false }
                    : notification
            )
        );

        // Remove from array after animation completes
        setTimeout(() => {
            setNotifications(prev => prev.filter(notification => notification.id !== id));
        }, 300);
    }, []);

    const showSuccess = useCallback((message, duration) => {
        return showNotification(message, 'success', duration);
    }, [showNotification]);

    const showError = useCallback((message, duration) => {
        return showNotification(message, 'error', duration);
    }, [showNotification]);

    const showWarning = useCallback((message, duration) => {
        return showNotification(message, 'warning', duration);
    }, [showNotification]);

    const showInfo = useCallback((message, duration) => {
        return showNotification(message, 'info', duration);
    }, [showNotification]);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const value = {
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideNotification,
        clearAll
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}

            {/* Render notifications */}
            {notifications.map((notification, index) => (
                <Snackbar
                    key={notification.id}
                    open={notification.open}
                    autoHideDuration={null}
                    onClose={() => hideNotification(notification.id)}
                    TransitionComponent={SlideTransition}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    sx={{
                        top: `${80 + (index * 70)}px !important`,
                        zIndex: 9999,
                        '& .MuiSnackbarContent-root': {
                            padding: 0,
                        },
                    }}
                >
                    <Alert
                        onClose={() => hideNotification(notification.id)}
                        severity={notification.severity}
                        variant="filled"
                        sx={{
                            width: '100%',
                            minWidth: '300px',
                            maxWidth: '500px',
                            boxShadow: 3,
                        }}
                    >
                        {notification.message}
                    </Alert>
                </Snackbar>
            ))}
        </NotificationContext.Provider>
    );
};
