// src/utils/api.js

import { getApiUrl } from './url';

// Handle 401 errors by clearing auth token
const handle401Error = () => {
    localStorage.removeItem('auth_token');
    // The AuthContext will handle the redirect
};

/**
 * API Error class for better error handling
 */
export class ApiError extends Error {
    constructor(message, status, response = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }
}

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
    const timeout = options.timeout || 10000; // Increased default timeout to 10 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    try {
        const response = await fetch(getApiUrl(path), fetchOptions);
        clearTimeout(timeoutId);

        // Parse response data first to get error details
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Handle 401 errors
        if (response.status === 401) {
            handle401Error();
        }

        // Handle non-ok responses with detailed error messages
        if (!response.ok) {
            const errorMessage = data?.error || data?.message || `HTTP ${response.status}`;
            throw new ApiError(errorMessage, response.status, response);
        }

        return { data, response };

    } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle network/timeout errors
        if (error.name === 'AbortError') {
            throw new ApiError('Request timeout - please try again', 408);
        }
        
        if (error instanceof ApiError) {
            throw error;
        }
        
        // Network or other errors
        throw new ApiError(`Network error: ${error.message}`, 0);
    }
};