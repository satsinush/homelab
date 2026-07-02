import { Request, Response } from 'express';
import Settings from '../models/Settings';
import fs from 'fs';
import config from '../config';
import HostApiService, { HostApiResponse } from '../services/hostApiService';
import { sendError, sendSuccess } from '../utils/response';

interface BasicSystemInfo {
    hostname: string;
    platform: string;
    uptime: number;
    memory?: { total: number; used: number; free: number };
    cpu?: { cores: number; model: string };
    source?: string;
}

interface ResourceUsage {
    cpu: { usage: number; cores: number; model: string };
    memory: { total: number; used: number; free: number; percentage: number };
    disk: { total: number; used: number; available: number; percentage: number };
    source?: string;
}

interface TemperatureInfo {
    cpu: number | null;
}

interface NetworkStats {
    interfaces: Array<{
        name: string;
        downloadSpeed?: number;
        uploadSpeed?: number;
        active?: boolean;
    }>;
    source?: string;
    timestamp?: string;
}

export interface PackageInfo {
    packages: Array<{ name: string; currentVersion: string; newVersion: string | null; hasUpdate: boolean; status: string }>;
    totalPackages: number;
    updatesAvailable: number;
    lastChecked: string;
    lastSynced: string | null;
    packageManager: string;
    note: string;
}

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
            const systemInfo = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                platform: 'unknown',
                hostname: 'unknown',
                version: '1.0.0',
                hostApi: 'unavailable'
            };

            try {
                const hostApiHealth = await this.hostApi.healthCheck() as { status?: string; platform?: string; hostname?: string } & HostApiResponse;
                if (hostApiHealth && hostApiHealth.status === 'OK') {
                    systemInfo.platform = hostApiHealth.platform || 'unknown';
                    systemInfo.hostname = hostApiHealth.hostname || 'unknown';
                    systemInfo.hostApi = 'available';
                }
            } catch (error: unknown) {
                const err = error as Error;
                console.warn('Could not fetch health check from Host API:', err.message);
            }

            return sendSuccess(res, systemInfo);
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Health check error:', err);
            return sendError(res, 500, 'Health check failed', err.message);
        }
    }

    // Get server settings
    async getSettings(req: Request, res: Response) {
        try {
            const settings = this.settingsModel.get();
            return sendSuccess(res, { settings: settings });
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Get settings error:', err);
            return sendError(res, 500, 'Failed to retrieve settings', err.message);
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Update settings error:', err);
            return sendError(res, 500, 'Failed to update settings', err.message);
        }
    }

    // Get system information
    async getSystemInfo(req: Request, res: Response) {
        try {
            const systemInfo = await this.getCombinedSystemInfo();
            return sendSuccess(res, systemInfo);
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Get system info error:', err);
            return sendError(res, 500, 'Failed to retrieve system information', err.message);
        }
    }

    // Get package information
    async getPackages(req: Request, res: Response) {
        try {
            const packageInfo = await this.getPackageInfo();
            return sendSuccess(res, { packages: packageInfo.packages, updatesAvailable: packageInfo.updatesAvailable, lastChecked: packageInfo.lastChecked, lastSynced: packageInfo.lastSynced, packageManager: packageInfo.packageManager, note: packageInfo.note });
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Get CPU info error:', err);
            return sendError(res, 500, 'Failed to retrieve CPU information', err.message);
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Manual package update check error:', err);
            return sendError(res, 500, 'Failed to check for package updates', err.message);
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
                } catch (readError: unknown) {
                    const err = readError as Error;
                    console.error('Error reading RustDesk public key:', err);
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Get RustDesk config error:', err);
            return sendError(res, 500, 'Failed to retrieve RustDesk configuration', err.message);
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
                    } catch (readError: unknown) {
                        const err = readError as Error;
                        console.warn(`Could not read container metadata file: ${err.message}`);
                    }
                }
            }

            return sendSuccess(res, { secrets: secretsList });
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Get Docker container info error:', err);
            return sendError(res, 500, 'Failed to retrieve Docker containers', err.message);
        }
    }

    // Get basic system information from Host API
    async getBasicSystemInfo(): Promise<BasicSystemInfo> {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            const data = metrics.data as { system?: BasicSystemInfo } | undefined;
            if (metrics && metrics.success && data && data.system) {
                return data.system;
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
    async getResourceUsage(): Promise<ResourceUsage> {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            const data = metrics.data as { resources?: ResourceUsage } | undefined;
            if (metrics && metrics.success && data && data.resources) {
                return data.resources;
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
    async getTemperature(): Promise<TemperatureInfo> {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            const data = metrics.data as { temperature?: TemperatureInfo } | undefined;
            if (metrics && metrics.success && data && data.temperature) {
                return data.temperature;
            }
        } catch (error) {
            console.error('Host API temperature fetch error:', error);
        }
        return { cpu: null };
    }

    // Get network statistics from Host API
    async getNetworkStats(): Promise<NetworkStats> {
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            const data = metrics.data as { network?: NetworkStats } | undefined;
            if (metrics && metrics.success && data && data.network) {
                return data.network;
            }
        } catch (error) {
            console.error('Host API network stats error:', error);
        }
        return { interfaces: [] as Array<{ name: string; downloadSpeed?: number; uploadSpeed?: number; active?: boolean }>, source: 'fallback', timestamp: new Date().toISOString() };
    }

    // Get combined system information from Host API
    async getCombinedSystemInfo() {
        const startTime = Date.now();
        try {
            const metrics = await this.hostApi.getSystemMetrics();
            const data = metrics.data as {
                system?: BasicSystemInfo;
                resources?: ResourceUsage;
                temperature?: TemperatureInfo;
                network?: NetworkStats;
            } | undefined;

            if (!metrics || !metrics.success || !data) {
                throw new Error(metrics ? metrics.error : 'Invalid response from Host API');
            }

            const { system, resources, temperature, network } = data;

            // Filter network interfaces
            let filteredInterfaces: Array<{ name: string; downloadSpeed?: number; uploadSpeed?: number; active?: boolean }> = [];
            if (network && Array.isArray(network.interfaces)) {
                filteredInterfaces = network.interfaces.filter((iface: { name: string }) => 
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
                    source: network?.source || 'host-api',
                    timestamp: network?.timestamp || new Date().toISOString()
                },
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                dataSource: 'host-api'
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Combined system info error:', err);
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
                error: err.message
            };
        }
    }

    // Get package information
    async getPackageInfo(): Promise<PackageInfo> {
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
            const data = packagesResult.data as { packages?: Array<{ name: string; version: string }> } | undefined;
            if (!packagesResult.success || !data || !data.packages) {
                console.error('Package list error from host API');
                return new Map();
            }

            const packages = new Map();
            const packageList = data.packages;
            
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Package list error:', err.message);
            return new Map();
        }
    }

    async getPackageSyncTime() {
        try {
            const syncResult = await this.hostApi.getPackageSyncTime();
            const data = syncResult.data as { syncTime?: string } | undefined;
            if (!syncResult.success || !data) {
                console.error('Package sync time error from host API');
                return null;
            }
            
            const syncTime = data.syncTime;
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Package sync time error:', err.message);
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
            const data = updatesResult.data as { updates?: string } | undefined;
            const updatesData = data?.updates;
            
            if (updatesData && updatesData !== 'No updates available') {
                const lines = updatesData.split('\n').filter(line => line.trim());
                
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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Package update check error:', err.message);
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
            network: (networkStats.interfaces || []).map(iface => ({
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
