import config from '../config';

export interface HostApiResponse {
    success: boolean;
    data?: unknown;
    error?: string;
    code?: number;
    [key: string]: unknown;
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
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeout || 30000),
                headers: {
                    'Content-Type': 'application/json',
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
