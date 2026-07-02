import { Request, Response } from 'express';
import Settings from '../models/Settings';
import fs from 'fs';
import config from '../config';
import HostApiService from '../services/hostApiService';
import { sendError, sendSuccess } from '../utils/response';

class SystemController {
    private settingsModel: Settings;
    private hostApi: HostApiService;

    constructor() {
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();
    }

    // Health check (no auth required)
    async healthCheck(req: Request, res: Response) {
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
                const hostApiHealth = await this.hostApi.healthCheck();
                if (hostApiHealth && hostApiHealth.status === 'OK') {
                    systemInfo.platform = hostApiHealth.platform || 'unknown';
                    systemInfo.hostname = hostApiHealth.hostname || 'unknown';
                    systemInfo.hostApi = 'available';
                }
            } catch (error: any) {
                console.warn('Could not fetch health check from Host API:', error.message);
            }

            return sendSuccess(res, systemInfo);
        } catch (error: any) {
            console.error('Health check error:', error);
            return sendError(res, 500, 'Health check failed', error.message);
        }
    }

    // Get server settings
    async getSettings(req: Request, res: Response) {
        try {
            const settings = this.settingsModel.get();
            return sendSuccess(res, { settings: settings });
        } catch (error: any) {
            console.error('Get settings error:', error);
            return sendError(res, 500, 'Failed to retrieve settings', error.message);
        }
    }

    // Update server settings
    async updateSettings(req: Request, res: Response) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const updatedSettings = this.settingsModel.update(req.body);
            return sendSuccess(res, { 
                message: 'Settings updated successfully', 
                settings: updatedSettings 
            });
        } catch (error: any) {
            console.error('Update settings error:', error);
            return sendError(res, 500, 'Failed to update settings', error.message);
        }
    }

    // Get system information
    async getSystemInfo(req: Request, res: Response) {
        try {
            const systemInfo = await this.getCombinedSystemInfo();
            return sendSuccess(res, systemInfo);
        } catch (error: any) {
            console.error('Get system info error:', error);
            return sendError(res, 500, 'Failed to retrieve system information', error.message);
        }
    }

    // Get package information
    async getPackages(req: Request, res: Response) {
        try {
            const packageInfo = await this.getPackageInfo();
            return sendSuccess(res, { packages: packageInfo.packages, updatesAvailable: packageInfo.updatesAvailable, lastChecked: packageInfo.lastChecked, lastSynced: packageInfo.lastSynced, packageManager: packageInfo.packageManager, note: packageInfo.note });
        } catch (error: any) {
            console.error('Get packages error:', error);
            return sendError(res, 500, 'Failed to retrieve package information', error.message);
        }
    }

    // Trigger package update check
    async checkUpdates(req: Request, res: Response) {
        try {
            // Retrieve latest packages info
            const packageInfo = await this.getPackageInfo();
            return sendSuccess(res, {
                message: 'Package update check completed successfully',
                updatesAvailable: packageInfo.updatesAvailable,
                lastChecked: packageInfo.lastChecked
            });
        } catch (error: any) {
            console.error('Manual package update check error:', error);
            return sendError(res, 500, 'Failed to check for package updates', error.message);
        }
    }

    // Get RustDesk configuration (relay host and public key)
    async getRustDeskConfig(req: Request, res: Response) {
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
        } catch (error: any) {
            console.error('Get RustDesk config error:', error);
            return sendError(res, 500, 'Failed to retrieve RustDesk configuration', error.message);
        }
    }

    // Get all secrets in /secrets (admin-only)
    async getSecrets(req: Request, res: Response) {
        try {
            const secretsDir = '/run/secrets';
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
                    } catch (readError: any) {
                        console.error(`Failed to read secret ${file}:`, readError.message);
                    }
                }
            }

            return sendSuccess(res, { secrets: secretsList });
        } catch (error: any) {
            console.error('Get secrets error:', error);
            return sendError(res, 500, 'Failed to retrieve secrets', error.message);
        }
    }

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
            cpu: { usage: 0, cores: 1, model: 'Unknown' },
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
        return { interfaces: [] as any[], source: 'fallback', timestamp: new Date().toISOString() };
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
                filteredInterfaces = network.interfaces.filter((iface: any) => 
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
        } catch (error: any) {
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

            const packages = [];
            for (const [packageName, packageData] of installedPackages) {
                const updateInfo = availableUpdates.get(packageName);
                
                if (updateInfo) {
                    packages.push({
                        name: packageName,
                        currentVersion: updateInfo.currentVersion,
                        newVersion: updateInfo.newVersion,
                        hasUpdate: true,
                        status: 'upgradeable'
                    });
                } else {
                    packages.push({
                        name: packageName,
                        currentVersion: packageData.currentVersion,
                        newVersion: null,
                        hasUpdate: false,
                        status: 'installed'
                    });
                }
            }

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
        } catch (error: any) {
            console.error('Package list error:', error.message);
            return new Map();
        }
    }

    async getPackageSyncTime() {
        try {
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
                const parsedDate = new Date(syncTime);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }
            }
            return null;
        } catch (error: any) {
            console.error('Package sync time error:', error.message);
            return null;
        }
    }

    async getAvailableUpdates() {
        try {
            const updatesResult = await this.hostApi.getAvailableUpdates();
            if (!updatesResult.success) {
                if (updatesResult.code === 1) {
                    return new Map();
                }
                console.error('Package update check error from host API');
                return new Map();
            }

            const updates = new Map();
            const updatesData = updatesResult.data?.updates;
            
            if (updatesData && updatesData !== 'No updates available') {
                const lines = updatesData.split('\n').filter((line: string) => line.trim());
                
                for (const line of lines) {
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
        } catch (error: any) {
            console.error('Package update check error:', error.message);
            return new Map();
        }
    }

    // Simple function for system prompt info
    async getSystemPromptInfo() {
        const system = await this.getBasicSystemInfo();
        const resources = await this.getResourceUsage();
        const networkStats = await this.getNetworkStats();
        const temperature = await this.getTemperature();

        const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const formatPercent = (value: number) => `${value}%`;

        const info = {
            system: {
                hostname: system.hostname,
                platform: system.platform,
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
                    free: formatBytes(resources.disk.available),
                    usage: formatPercent(resources.disk.percentage)
                }
            },
            temperature: {
                cpu: `${temperature.cpu ? temperature.cpu + "'C" : 'N/A'}`,
            },
            network: Object.values(networkStats.interfaces || {}).map((iface: any) => ({
                name: iface.name,
                downloadSpeed: formatBytes(iface.downloadSpeed || 0) + '/s',
                uploadSpeed: formatBytes(iface.uploadSpeed || 0) + '/s',
                active: iface.active
            }))
        };

        return JSON.stringify(info);
    }
}

export default SystemController;
