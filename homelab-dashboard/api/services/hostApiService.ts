import config from '../config';

class HostApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.hostApi.url;
    }

    async makeRequest(endpoint: string, options: any = {}): Promise<any> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                // @ts-ignore
                timeout: options.timeout || 30000,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({}));
                throw new Error(`Host API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Host API request failed:', error);
            throw error;
        }
    }

    // Network operations
    async scanNetwork(timeout: number = 30000): Promise<any> {
        return this.makeRequest('/network/scan', {
            method: 'POST',
            body: JSON.stringify({ timeout }),
            timeout
        });
    }

    async sendWakeOnLan(mac: string): Promise<any> {
        return this.makeRequest('/network/wake-on-lan', {
            method: 'POST',
            body: JSON.stringify({ mac })
        });
    }

    // Package management
    async getInstalledPackages(): Promise<any> {
        return this.makeRequest('/packages/installed');
    }

    async getAvailableUpdates(): Promise<any> {
        return this.makeRequest('/packages/updates');
    }

    async getPackageSyncTime(): Promise<any> {
        return this.makeRequest('/packages/sync-time');
    }

    // Health check
    async healthCheck(): Promise<any> {
        return this.makeRequest('/health');
    }

    // System metrics monitoring
    async getSystemMetrics(): Promise<any> {
        return this.makeRequest('/system/metrics');
    }
}

export default HostApiService;
