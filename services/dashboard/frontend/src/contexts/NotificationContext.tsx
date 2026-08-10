// src/contexts/NotificationContext.tsx
import React, { useState, useCallback, ReactNode } from 'react';
import {
    Snackbar,
    Alert,
    Slide,
    SlideProps,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography
} from '@mui/material';
import { NotificationContext, AppNotification, ConfirmDialogOptions, NotificationContextType } from './NotificationContextCore';

function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction="down" />;}

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmText: string;
        cancelText: string;
        confirmColor: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
        onConfirm: (() => void) | null;
        onCancel: (() => void) | null;
    }>({
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        confirmColor: 'primary',
        onConfirm: null,
        onCancel: null
    });

    const hideNotification = useCallback((id: number) => {
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

    const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 6000): number => {
        const id = Date.now() + Math.random();
        const notification: AppNotification = {
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
    }, [hideNotification]);

    const showSuccess = useCallback((message: string, duration?: number) => {
        return showNotification(message, 'success', duration);
    }, [showNotification]);

    const showError = useCallback((message: string, duration?: number) => {
        return showNotification(message, 'error', duration);
    }, [showNotification]);

    const showWarning = useCallback((message: string, duration?: number) => {
        return showNotification(message, 'warning', duration);
    }, [showNotification]);

    const showInfo = useCallback((message: string, duration?: number) => {
        return showNotification(message, 'info', duration);
    }, [showNotification]);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // Confirmation dialog functions
    const showConfirmDialog = useCallback((options: ConfirmDialogOptions) => {
        const {
            title = 'Confirm Action',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmColor = 'primary',
            onConfirm = null,
            onCancel = null
        } = options;

        setConfirmDialog({
            open: true,
            title,
            message,
            confirmText,
            cancelText,
            confirmColor,
            onConfirm,
            onCancel
        });
    }, []);

    const hideConfirmDialog = useCallback(() => {
        setConfirmDialog(prev => ({
            ...prev,
            open: false
        }));
    }, []);

    const handleConfirmDialogConfirm = useCallback(() => {
        if (confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
        }
        hideConfirmDialog();
    }, [confirmDialog, hideConfirmDialog]);

    const handleConfirmDialogCancel = useCallback(() => {
        if (confirmDialog.onCancel) {
            confirmDialog.onCancel();
        }
        hideConfirmDialog();
    }, [confirmDialog, hideConfirmDialog]);

    const value: NotificationContextType = {
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideNotification,
        clearAll,
        showConfirmDialog,
        hideConfirmDialog
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

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={handleConfirmDialogCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ pb: 2 }}>
                    {confirmDialog.title}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        {confirmDialog.message}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={handleConfirmDialogCancel}
                        variant="outlined"
                    >
                        {confirmDialog.cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirmDialogConfirm}
                        variant="contained"
                        color={confirmDialog.confirmColor}
                        autoFocus
                    >
                        {confirmDialog.confirmText}
                    </Button>
                </DialogActions>
            </Dialog>
        </NotificationContext.Provider>
    );
};
