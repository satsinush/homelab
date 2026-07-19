import fs from 'fs';
import path from 'path';
import config from '../config';

export interface HostApiResponse {
    success: boolean;
    data?: unknown;
    error?: string;
    code?: number;
    [key: string]: unknown;
}

const HOST_API_TOKEN_PATH = path.join(config.secretsDir, 'host_api_token');

function readHostApiToken(): string | null {
    // Read per request so a rotated token (re-run setup) works without a container restart.
    try {
        const token = fs.readFileSync(HOST_API_TOKEN_PATH, 'utf8').trim();
        return token || null;
    } catch {
        return null;
    }
}

class HostApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.hostApi.url;
    }

    async makeRequest(endpoint: string, options: RequestInit & { timeout?: number; headers?: Record<string, string> } = {}): Promise<HostApiResponse> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const { timeout, ...fetchOptions } = options;
            const token = readHostApiToken();
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeout || 30000),
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...options.headers
                },
                ...fetchOptions
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
                throw new Error(`Host API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            return await response.json() as HostApiResponse;
        } catch (error) {
            console.error('Host API request failed:', error);
            throw error;
        }
    }

    // Network operations
    async scanNetwork(timeout: number = 30000): Promise<HostApiResponse> {
        return this.makeRequest('/network/scan', {
            method: 'POST',
            body: JSON.stringify({ timeout }),
            timeout
        });
    }

    async sendWakeOnLan(mac: string): Promise<HostApiResponse> {
        return this.makeRequest('/network/wake-on-lan', {
            method: 'POST',
            body: JSON.stringify({ mac })
        });
    }

    // Package management
    async getInstalledPackages(): Promise<HostApiResponse> {
        return this.makeRequest('/packages/installed');
    }

    async getAvailableUpdates(): Promise<HostApiResponse> {
        return this.makeRequest('/packages/updates');
    }

    async getPackageSyncTime(): Promise<HostApiResponse> {
        return this.makeRequest('/packages/sync-time');
    }

    // File-access (Samba/WebDAV) account management
    async getFileAccounts(): Promise<HostApiResponse> {
        return this.makeRequest('/file-accounts');
    }

    async createFileAccount(username: string, password: string, isAdmin?: boolean): Promise<HostApiResponse> {
        return this.makeRequest('/file-accounts', {
            method: 'POST',
            body: JSON.stringify({ username, password, isAdmin }),
            timeout: 120000 // recreates samba + sftpgo containers
        });
    }

    async updateFileAccountPassword(username: string, password: string, isAdmin?: boolean): Promise<HostApiResponse> {
        return this.makeRequest(`/file-accounts/${encodeURIComponent(username)}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password, isAdmin }),
            timeout: 120000
        });
    }

    async deleteFileAccount(username: string): Promise<HostApiResponse> {
        return this.makeRequest(`/file-accounts/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            timeout: 120000
        });
    }

    // Health check
    async healthCheck(): Promise<HostApiResponse> {
        return this.makeRequest('/health');
    }

    // System metrics monitoring
    async getSystemMetrics(): Promise<HostApiResponse> {
        return this.makeRequest('/system/metrics');
    }
}

export default HostApiService;
