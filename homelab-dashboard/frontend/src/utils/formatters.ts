// src/utils/formatters.ts
// Utility functions for formatting data in the frontend

export interface DisplayDevice {
    mac: string;
    macNormalized: string;
    [key: string]: unknown;
}

/**
 * Format a normalized MAC address for display
 * Converts from '00d86178e934' to '00-D8-61-78-E9-34'
 * @param {string} mac - Normalized MAC address (lowercase, no separators)
 * @returns {string} Formatted MAC address for display
 */
export const formatMacForDisplay = (mac: string): string => {
    if (!mac || typeof mac !== 'string') {
        return mac;
    }
    
    // Remove any existing separators and convert to lowercase
    const normalizedMac = mac.replace(/[:-]/g, '').toLowerCase();
    
    // Validate MAC format (12 hex characters)
    if (!/^[0-9a-f]{12}$/i.test(normalizedMac)) {
        return mac; // Return original if invalid
    }
    
    // Convert to uppercase and add dashes every 2 characters
    return (normalizedMac
        .toUpperCase()
        .match(/.{2}/g) || [])
        .join('-');
};

/**
 * Normalize a MAC address for API requests
 * Converts from any format to '00d86178e934'
 * @param {string} mac - MAC address in any format
 * @returns {string} Normalized MAC address (lowercase, no separators)
 */
export const normalizeMacForApi = (mac: string): string => {
    if (!mac || typeof mac !== 'string') {
        return mac;
    }
    
    // Remove separators and convert to lowercase
    return mac.replace(/[:-]/g, '').toLowerCase();
};

/**
 * Format device data for display by applying MAC formatting
 * @param {any} device - Device object with MAC address
 * @returns {any} Device object with formatted MAC address
 */
export const formatDeviceForDisplay = (device: any): any => {
    if (!device) return device;
    
    return {
        ...device,
        mac: formatMacForDisplay(device.mac),
        // Add display property to preserve original for API calls
        macNormalized: device.mac
    };
};

/**
 * Format multiple devices for display
 * @param {any[]} devices - Array of device objects
 * @returns {any[]} Array of devices with formatted MAC addresses
 */
export const formatDevicesForDisplay = (devices: any[]): any[] => {
    if (!Array.isArray(devices)) return devices;
    
    return devices.map(device => formatDeviceForDisplay(device));
};

/**
 * Format file sizes for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format timestamps for display
 * @param {string|Date} timestamp - ISO timestamp string or Date object
 * @returns {string} Formatted timestamp string
 */
export const formatTimestamp = (timestamp: string | Date): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleString();
};

/**
 * Format uptime for display
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
export const formatUptime = (seconds: number): string => {
    if (!seconds || seconds < 0) return 'Unknown';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
};
