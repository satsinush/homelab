// src/utils/api.ts

import { getApiUrl } from './url';
import { getErrorMessage } from './errors';

// Handle 401 errors by clearing auth token
const handle401Error = () => {
    localStorage.removeItem('auth_token');
    // The AuthContext will handle the redirect
};

/**
 * API Error class for better error handling
 */
export class ApiError extends Error {
    status: number;
    response: Response | null;

    constructor(message: string, status: number, response: Response | null = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }
}

interface CustomRequestInit extends RequestInit {
    data?: unknown;
    timeout?: number;
}

/**
 * Try API endpoints until one works using fetch
 * @param {string} path - The API path to call (e.g., '/devices', '/system-info')
 * @param {CustomRequestInit} options - Additional fetch options (method, headers, body, etc.)
 * @returns {Promise<{data: T, response: Response}>} Response data, raw response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tryApiCall = async <T = any>(path: string, options: CustomRequestInit = {}): Promise<{ data: T; response: Response }> => {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    // Add authentication header if token exists
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
        credentials: options.credentials || 'include'
    };

    if (options.data !== undefined) {
        fetchOptions.body = JSON.stringify(options.data);
    } else if (options.body !== undefined) {
        fetchOptions.body = options.body as BodyInit;
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
        let data: T;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json() as T;
        } else {
            const text = await response.text();
            data = text as unknown as T;
        }

        // Handle 401 errors
        if (response.status === 401) {
            handle401Error();
        }

        // Handle non-ok responses with detailed error messages
        if (!response.ok) {
            const errorData = data as Record<string, unknown> | null;
            const errorMessage = ((errorData?.error || errorData?.message || `HTTP ${response.status}`) as string) || `HTTP ${response.status}`;
            throw new ApiError(errorMessage, response.status, response);
        }

        return { data, response };

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new ApiError('Request timeout - please try again', 408);
        }
        
        if (error instanceof ApiError) {
            throw error;
        }
        
        // Network or other errors
        throw new ApiError(`Network error: ${getErrorMessage(error)}`, 0);
    }
};