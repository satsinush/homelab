// src/utils/api.js
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;

// API endpoints in order of preference
export const API_ENDPOINTS = [
    //'http://localhost:5000/api',                 // Development first
    'https://admin.rpi5-server.home.arpa/api',  // Primary HTTPS
    'http://admin.rpi5-server.home.arpa/api',   // HTTP fallback
    'http://10.10.10.10:5000/api',              // Direct IP fallback
];

// Configure axios interceptors for authentication
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear token and redirect to login if we get 401
            localStorage.removeItem('auth_token');
            delete axios.defaults.headers.common['Authorization'];
            // The AuthContext will handle the redirect
        }
        return Promise.reject(error);
    }
);

/**
 * Try API endpoints until one works
 * @param {string} path - The API path to call (e.g., '/devices', '/system-info')
 * @param {Object} options - Additional axios options (timeout, method, data, etc.)
 * @returns {Promise<{data: any, baseUrl: string}>} Response data and working base URL
 */
export const tryApiCall = async (path, options = {}) => {
    const defaultOptions = {
        timeout: 5000,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    for (const baseUrl of API_ENDPOINTS) {
        try {
            const response = await axios({
                ...mergedOptions,
                url: `${baseUrl}${path}`
            });
            return { data: response.data, baseUrl };
        } catch (err) {
            continue;
        }
    }
    throw new Error('All API endpoints failed');
};

/**
 * Get a working API base URL by testing the health endpoint
 * @returns {Promise<string>} Working API base URL
 */
export const getWorkingApiUrl = async () => {
    try {
        const result = await tryApiCall('/health');
        return result.baseUrl;
    } catch (err) {
        throw new Error('No API endpoints are responding');
    }
};

/**
 * Make an API call using a known working base URL
 * @param {string} baseUrl - The working base URL
 * @param {string} path - The API path to call
 * @param {Object} options - Additional axios options
 * @returns {Promise<any>} Response data
 */
export const apiCall = async (baseUrl, path, options = {}) => {
    const defaultOptions = {
        timeout: 5000,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };

    const mergedOptions = { ...defaultOptions, ...options };
    
    const response = await axios({
        ...mergedOptions,
        url: `${baseUrl}${path}`
    });
    
    return response.data;
};
