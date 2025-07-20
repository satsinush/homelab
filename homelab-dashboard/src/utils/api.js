// src/utils/api.js

import { getApiUrl } from './url';

// Handle 401 errors by clearing auth token
const handle401Error = () => {
    localStorage.removeItem('auth_token');
    // The AuthContext will handle the redirect
};

/**
 * Try API endpoints until one works using fetch
 * @param {string} path - The API path to call (e.g., '/devices', '/system-info')
 * @param {Object} options - Additional fetch options (method, headers, body, etc.)
 * @returns {Promise<{data: any, response: Response, baseUrl: string}>} Response data, raw response, and working base URL
 */
export const tryApiCall = async (path, options = {}) => {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    };

    // Add authentication header if token exists
    const token = localStorage.getItem('auth_token');
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    // Convert axios-style data to fetch-style body
    const fetchOptions = { ...defaultOptions, ...options };
    if (options.data && !fetchOptions.body) {
        fetchOptions.body = JSON.stringify(options.data);
        delete fetchOptions.data;
    }

    // Handle timeout
    const timeout = options.timeout || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    const response = await fetch(getApiUrl(path), fetchOptions);
    clearTimeout(timeoutId);

    // Handle 401 errors
    if (response.status === 401) {
        handle401Error();
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    // Parse response data
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    return { data, response };
};

/**
 * Try API endpoints for streaming responses (returns raw Response object)
 * @param {string} path - The API path to call
 * @param {Object} options - Additional fetch options
 * @returns {Promise<{response: Response, baseUrl: string}>} Raw response and working base URL
 */
export const tryStreamingApiCall = async (path, options = {}) => {
    const defaultOptions = {
        method: 'POST',
        headers: {
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    };

    // Add authentication header if token exists
    const token = localStorage.getItem('auth_token');
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = { ...defaultOptions, ...options };
    
    // Convert axios-style data to fetch-style body
    if (options.data && !fetchOptions.body) {
        fetchOptions.body = JSON.stringify(options.data);
        delete fetchOptions.data;
    }

    const response = await fetch(getApiUrl(path), fetchOptions);

    // Handle 401 errors
    if (response.status === 401) {
        handle401Error();
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return { response };
};


