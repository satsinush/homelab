const config = require('../config');

class HostApiService {
    constructor() {
        this.baseUrl = config.hostApi.url;
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                timeout: options.timeout || 30000,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Host API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Host API request failed:', error);
            throw error;
        }
    }

    // Network operations
    async scanNetwork(timeout = 30000) {
        return this.makeRequest('/network/scan', {
            method: 'POST',
            body: JSON.stringify({ timeout }),
            timeout
        });
    }

    async sendWakeOnLan(mac) {
        return this.makeRequest('/network/wake-on-lan', {
            method: 'POST',
            body: JSON.stringify({ mac })
        });
    }

    // Package management
    async getInstalledPackages() {
        return this.makeRequest('/packages/installed');
    }

    async getAvailableUpdates() {
        return this.makeRequest('/packages/updates');
    }

    async getPackageSyncTime() {
        return this.makeRequest('/packages/sync-time');
    }

    // Health check
    async healthCheck() {
        return this.makeRequest('/health');
    }
}

module.exports = HostApiService;
