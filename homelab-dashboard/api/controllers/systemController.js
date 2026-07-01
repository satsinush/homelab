const Settings = require('../models/Settings');
const fs = require('fs');
const config = require('../config');
const HostApiService = require('../services/hostApiService');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class SystemController {
    constructor() {
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();
    }

    // Health check (no auth required)
    async healthCheck(req, res) {
        try {
            let systemInfo = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                platform: 'unknown',
                hostname: 'unknown',
                version: '1.0.0',
                hostApi: 'unavailable'
            };

            try {
                // Check if Host API is available
                const hostApiHealth = await this.hostApi.healthCheck();
                if (hostApiHealth && hostApiHealth.status === 'OK') {
                    systemInfo.platform = hostApiHealth.platform || 'unknown';
                    systemInfo.hostname = hostApiHealth.hostname || 'unknown';
                    systemInfo.hostApi = 'available';
                }
            } catch (error) {
                console.warn('Could not fetch health check from Host API:', error.message);
            }

            return sendSuccess(res, systemInfo);
        } catch (error) {
            console.error('Health check error:', error);
            return sendError(res, 500, 'Health check failed', error.message);
        }
    }

    // Get server settings
    async getSettings(req, res) {
        try {
            const settings = this.settingsModel.get();
            return sendSuccess(res, { settings: settings });
        } catch (error) {
            console.error('Get settings error:', error);
            return sendError(res, 500, 'Failed to retrieve settings', error.message);
        }
    }

    // Update server settings
    async updateSettings(req, res) {
        try {
            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const updatedSettings = this.settingsModel.update(req.body);
            return sendSuccess(res, { 
                message: 'Settings updated successfully', 
                settings: updatedSettings 
            });
        } catch (error) {
            console.error('Update settings error:', error);
            return sendError(res, 500, 'Failed to update settings', error.message);
        }
    }

    // Get system information
    async getSystemInfo(req, res) {
        try {
            const systemInfo = await this.getCombinedSystemInfo();
            return sendSuccess(res, systemInfo);
        } catch (error) {
            console.error('Get system info error:', error);
            return sendError(res, 500, 'Failed to retrieve system information', error.message);
        }
    }

    // Get package information
    async getPackages(req, res) {
        try {
            const packageInfo = await this.getPackageInfo();
            return sendSuccess(res, packageInfo);
        } catch (error) {
            console.error('Get packages error:', error);
            return sendError(res, 500, 'Failed to retrieve package information', error.message);
        }
    }

    // Get RustDesk configuration (relay host and public key)
    async getRustDeskConfig(req, res) {
        try {
            const relayHost = config.homelabHostname;
            let publicKey = null;
            let errorFlag = false;

            if (config.rustdeskPubKeyPath) {
                try {
                    if (fs.existsSync(config.rustdeskPubKeyPath)) {
                        publicKey = fs.readFileSync(config.rustdeskPubKeyPath, 'utf8').trim();
                    } else {
                        console.warn(`RustDesk public key file not found at: ${config.rustdeskPubKeyPath}`);
                        errorFlag = true;
                    }
                } catch (readError) {
                    console.error('Error reading RustDesk public key:', readError);
                    errorFlag = true;
                }
            } else {
                errorFlag = true;
            }

            return sendSuccess(res, {
                relayHost: relayHost,
                publicKey: publicKey,
                available: !errorFlag && !!publicKey
            });
        } catch (error) {
            console.error('Get RustDesk config error:', error);
            return sendError(res, 500, 'Failed to retrieve RustDesk configuration', error.message);
        }
    }

    // Get all secrets in /secrets (admin-only)
    async getSecrets(req, res) {
        try {
            const secretsDir = '/secrets';
            if (!fs.existsSync(secretsDir)) {
                return sendSuccess(res, { secrets: [] });
            }

            const files = fs.readdirSync(secretsDir);
            const secretsList = [];

            for (const file of files) {
                const filePath = `${secretsDir}/${file}`;
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    try {
                        const value = fs.readFileSync(filePath, 'utf8').trim();
                        secretsList.push({
                            name: file,
                            value: value
                        });
                    } catch (readError) {
                        console.error(`Failed to read secret ${file}:`, readError.message);
                    }
                }
            }

            return sendSuccess(res, { secrets: secretsList });
        } catch (error) {
            console.error('Get secrets error:', error);
            return sendError(res, 500, 'Failed to retrieve secrets', error.message);
        }
    }

    // Internal methods (moved from SystemService)

    // Get basic system information from Host API
    async getBasicSystemInfo() {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            if (metrics && metrics.success && metrics.data) {
                return metrics.data.system;
            }
        } catch (error) {
            console.error('Host API system info fetch error:', error);
        }
        return {
            hostname: 'unknown',
            platform: 'unknown',
            uptime: 0,
            memory: { total: 0, used: 0, free: 0 },
            cpu: { cores: 1, model: 'Unknown' },
            source: 'fallback'
        };
    }

    // Get resource usage from Host API
    async getResourceUsage() {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            if (metrics && metrics.success && metrics.data) {
                return metrics.data.resources;
            }
        } catch (error) {
            console.error('Host API resource usage fetch error:', error);
        }
        return {
            cpu: { usage: 0 },
            memory: { total: 0, used: 0, free: 0, percentage: 0 },
            disk: { total: 0, used: 0, available: 0, percentage: 0 },
            source: 'fallback'
        };
    }

    // Get temperature information from Host API
    async getTemperature() {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            if (metrics && metrics.success && metrics.data) {
                return metrics.data.temperature;
            }
        } catch (error) {
            console.error('Host API temperature fetch error:', error);
        }
        return { cpu: null };
    }

    // Get network statistics from Host API
    async getNetworkStats() {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            if (metrics && metrics.success && metrics.data) {
                return metrics.data.network;
            }
        } catch (error) {
            console.error('Host API network stats error:', error);
        }
        return { interfaces: [], source: 'fallback', timestamp: new Date().toISOString() };
    }

    // Get combined system information from Host API
    async getCombinedSystemInfo() {
        const startTime = Date.now();
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            if (!metrics || !metrics.success || !metrics.data) {
                throw new Error(metrics ? metrics.error : 'Invalid response from Host API');
            }

            const { system, resources, temperature, network } = metrics.data;

            // Filter network interfaces
            let filteredInterfaces = [];
            if (network && Array.isArray(network.interfaces)) {
                filteredInterfaces = network.interfaces.filter(iface => 
                    iface.name !== 'total' && 
                    iface.name !== 'Total Network' && 
                    !iface.name.includes('veth') &&
                    iface.name !== 'docker0' &&
                    !iface.name.startsWith('br-')
                );
            }

            return {
                system,
                resources,
                temperature,
                network: {
                    interfaces: filteredInterfaces,
                    source: network.source || 'host-api',
                    timestamp: network.timestamp || new Date().toISOString()
                },
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                dataSource: 'host-api'
            };
        } catch (error) {
            console.error('Combined system info error:', error);
            return {
                system: { hostname: 'unknown', platform: 'unknown', uptime: 0, source: 'error' },
                resources: {
                    cpu: { usage: 0, cores: 1, model: 'Unknown' },
                    memory: { total: 0, used: 0, free: 0, percentage: 0, cached: 0, buffers: 0 },
                    disk: { total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' }
                },
                temperature: { cpu: null },
                network: { interfaces: [], source: 'error', timestamp: new Date().toISOString() },
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                dataSource: 'error',
                error: error.message
            };
        }
    }

    // Get package information
    async getPackageInfo() {
        try {
            const [installedPackages, availableUpdates, syncTime] = await Promise.all([
                this.getInstalledPackages(),
                this.getAvailableUpdates(),
                this.getPackageSyncTime()
            ]);

            // Merge the data
            const packages = [];
            for (const [packageName, packageData] of installedPackages) {
                const updateInfo = availableUpdates.get(packageName);
                
                if (updateInfo) {
                    // Package has an update available
                    packages.push({
                        name: packageName,
                        currentVersion: updateInfo.currentVersion,
                        newVersion: updateInfo.newVersion,
                        hasUpdate: true,
                        status: 'upgradeable'
                    });
                } else {
                    // Package is up to date
                    packages.push({
                        name: packageName,
                        currentVersion: packageData.currentVersion,
                        newVersion: null,
                        hasUpdate: false,
                        status: 'installed'
                    });
                }
            }

            // Sort packages by name
            packages.sort((a, b) => a.name.localeCompare(b.name));

            const updatesAvailable = packages.filter(pkg => pkg.hasUpdate).length;
            
            return {
                packages: packages,
                totalPackages: packages.length,
                updatesAvailable: updatesAvailable,
                lastChecked: new Date().toISOString(),
                lastSynced: syncTime ? syncTime.toISOString() : null,
                packageManager: 'pacman',
                note: updatesAvailable > 0 
                    ? `${updatesAvailable} updates available out of ${packages.length} packages`
                    : `All ${packages.length} packages are up to date`
            };
        } catch (error) {
            console.error('Package fetch error:', error);
            throw error;
        }
    }

    // Helper methods for package management
    async getInstalledPackages() {
        try {
            // Get installed packages from host API (now returns structured JSON)
            const packagesResult = await this.hostApi.getInstalledPackages();
            if (!packagesResult.success || !packagesResult.data || !packagesResult.data.packages) {
                console.error('Package list error from host API');
                return new Map();
            }

            const packages = new Map();
            const packageList = packagesResult.data.packages;
            
            for (const pkg of packageList) {
                packages.set(pkg.name, {
                    name: pkg.name,
                    currentVersion: pkg.version,
                    newVersion: null,
                    hasUpdate: false,
                    status: 'installed'
                });
            }
            
            return packages;
        } catch (error) {
            console.error('Package list error:', error.message);
            return new Map();
        }
    }

    async getPackageSyncTime() {
        try {
            // Get package sync time from host API (now returns structured JSON)
            const syncResult = await this.hostApi.getPackageSyncTime();
            if (!syncResult.success || !syncResult.data) {
                console.error('Package sync time error from host API');
                return null;
            }
            
            const syncTime = syncResult.data.syncTime;
            if (syncTime && syncTime !== 'Unknown') {
                const timestamp = parseInt(syncTime);
                if (!isNaN(timestamp)) {
                    return new Date(timestamp * 1000);
                }
                // Try to parse as date string
                const parsedDate = new Date(syncTime);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }
            }
            return null;
        } catch (error) {
            console.error('Package sync time error:', error.message);
            return null;
        }
    }

    async getAvailableUpdates() {
        try {
            // Get available updates from host API (now returns structured JSON)
            const updatesResult = await this.hostApi.getAvailableUpdates();
            if (!updatesResult.success) {
                // If it's just "no updates", that's okay
                if (updatesResult.code === 1) {
                    return new Map();
                }
                console.error('Package update check error from host API');
                return new Map();
            }

            const updates = new Map();
            const updatesData = updatesResult.data?.updates;
            
            if (updatesData && updatesData !== 'No updates available') {
                // Parse the updates string if it contains package info
                const lines = updatesData.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    // Try to parse package update format: "package-name old-version -> new-version"
                    const match = line.match(/^(.+?)\s+(.+?)\s+->\s+(.+?)$/);
                    if (match) {
                        const [, name, currentVersion, newVersion] = match;
                        updates.set(name.trim(), {
                            currentVersion: currentVersion.trim(),
                            newVersion: newVersion.trim()
                        });
                    }
                }
            }
            
            return updates;
        } catch (error) {
            console.error('Package update check error:', error.message);
            return new Map();
        }
    }

    // Simple function for system prompt info (for use in chat system prompt)
    async getSystemPromptInfo() {
        // Gather info
        const system = await this.getBasicSystemInfo();
        const resources = await this.getResourceUsage();
        const networkStats = await this.getNetworkStats();
        const temperature = await this.getTemperature();

        // Format bytes helper
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // Format %
        const formatPercent = (value) => `${value}%`;

        // Compose result
        const info = {
            system: {
                hostname: system.hostname,
                platform: system.platform,
                arch: system.arch,
                uptime: `${system.uptime}s`
            },
            resources: {
                cpu: {
                    cores: resources.cpu.cores,
                    usage: formatPercent(resources.cpu.usage)
                },
                memory: {
                    total: formatBytes(resources.memory.total),
                    used: formatBytes(resources.memory.used),
                    free: formatBytes(resources.memory.free),
                    usage: formatPercent(resources.memory.percentage)
                },
                disk: {
                    total: formatBytes(resources.disk.total),
                    used: formatBytes(resources.disk.used),
                    free: formatBytes(resources.disk.free),
                    usage: formatPercent(resources.disk.percentage)
                }
            },
            temperature: {
                cpu: `${temperature.cpu ? temperature.cpu + "'C" : 'N/A'}`,
            },
            network: Object.values(networkStats.interfaces || {}).map(iface => ({
                name: iface.name,
                downloadSpeed: formatBytes(iface.downloadSpeed || 0) + '/s',
                uploadSpeed: formatBytes(iface.uploadSpeed || 0) + '/s',
                active: iface.active
            }))
        };

        return JSON.stringify(info);
    }
}

module.exports = SystemController;
