import { createContext } from 'react';

export interface AppNotification {
    id: number;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
    duration: number;
    open: boolean;
}

export interface ConfirmDialogOptions {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
    onConfirm?: (() => void) | null;
    onCancel?: (() => void) | null;
}

export interface NotificationContextType {
    showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info', duration?: number) => number;
    showSuccess: (message: string, duration?: number) => number;
    showError: (message: string, duration?: number) => number;
    showWarning: (message: string, duration?: number) => number;
    showInfo: (message: string, duration?: number) => number;
    hideNotification: (id: number) => void;
    clearAll: () => void;
    showConfirmDialog: (options: ConfirmDialogOptions) => void;
    hideConfirmDialog: () => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);
