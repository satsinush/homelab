const Settings = require('../models/Settings');
const config = require('../config');
const HostApiService = require('../services/hostApiService');
const NetdataService = require('../services/netdataService');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class SystemController {
    constructor() {
        this.settingsModel = new Settings();
        this.hostApi = new HostApiService();
        this.netdata = new NetdataService();
    }

    // Health check (no auth required)
    async healthCheck(req, res) {
        try {
            // Get basic system info from Netdata instead of host API
            let systemInfo = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                platform: 'unknown',
                hostname: 'unknown',
                version: '1.0.0'
            };

            try {
                // Check if Netdata is available
                const netdataAvailable = await this.netdata.isAvailable();
                if (netdataAvailable) {
                    const infoResult = await this.netdata.getSystemInfo();
                    systemInfo.platform = infoResult.platform || 'unknown';
                    systemInfo.hostname = infoResult.hostname || 'unknown';
                    systemInfo.netdata = 'available';
                } else {
                    systemInfo.netdata = 'unavailable';
                    console.warn('Netdata is not available for health check');
                }
            } catch (error) {
                console.warn('Could not fetch system info from Netdata for health check:', error.message);
                systemInfo.netdata = 'error';
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

    // Internal methods (moved from SystemService)

    // Get basic system information from Netdata
    async getBasicSystemInfo() {
        try {
            // Get system info from Netdata instead of host API
            const systemInfo = await this.netdata.getSystemInfo();
            return systemInfo;
        } catch (error) {
            console.error('Netdata system info fetch error:', error);
            
            // Fallback data if Netdata fails
            return {
                hostname: 'unknown',
                platform: 'unknown',
                uptime: 0,
                memory: {
                    total: 0,
                    used: 0,
                    free: 0
                },
                cpu: {
                    cores: 1,
                    model: 'Unknown'
                },
                source: 'fallback'
            };
        }
    }

    // Get resource usage from Netdata
    async getResourceUsage() {
        try {
            // Get all resource data from Netdata
            const [cpuUsage, memoryUsage, diskUsage] = await Promise.allSettled([
                this.netdata.getCpuUsage(),
                this.netdata.getMemoryUsage(),
                this.netdata.getDiskUsage()
            ]);

            return {
                cpu: {
                    usage: cpuUsage.status === 'fulfilled' ? cpuUsage.value.usage : 0,
                },
                memory: memoryUsage.status === 'fulfilled' ? memoryUsage.value : {
                    total: 0,
                    used: 0,
                    free: 0,
                    percentage: 0
                },
                disk: diskUsage.status === 'fulfilled' ? diskUsage.value : {
                    total: 0,
                    used: 0,
                    available: 0,
                    percentage: 0
                },
                source: 'netdata'
            };
        } catch (error) {
            console.error('Netdata resource usage fetch error:', error);
            
            // Fallback to basic values if Netdata fails
            return {
                cpu: {
                    usage: 0,
                },
                memory: {
                    total: 0,
                    used: 0,
                    free: 0,
                    percentage: 0
                },
                disk: {
                    total: 0,
                    used: 0,
                    available: 0,
                    percentage: 0
                },
                source: 'fallback'
            };
        }
    }

    // Get temperature information from Netdata
    async getTemperature() {
        try {
            // Get temperature from Netdata
            const tempResult = await this.netdata.getTemperature();
            return tempResult;
        } catch (error) {
            console.error('Netdata temperature fetch error:', error);
            
            return {
                cpu: null 
            };
        }
    }

    // Get network statistics from Netdata
    async getNetworkStats() {
        try {
            // Get network statistics from Netdata
            const networkStats = await this.netdata.getNetworkStats();
            return networkStats;
        } catch (error) {
            console.error('Netdata network stats error:', error);
            return {
                interfaces: {},
                source: 'fallback',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Get network statistics from Netdata API
    async getNetdataNetworkStats() {
        // Get network interface charts and query each for real-time speed
        try {
            const netdataUrl = config.netdata.url;
            // Get list of available charts to find network interfaces
            const chartsResponse = await fetch(`${netdataUrl}/api/v1/charts`, {
                timeout: 5000
            });
            if (!chartsResponse.ok) {
                throw new Error(`Charts API responded with ${chartsResponse.status}`);
            }
            const chartsData = await chartsResponse.json();
            const interfaces = {};
            // Look for network interface charts (e.g., net.end0, net.eth0, net.wlan0)
            for (const chartId in chartsData.charts) {
                if (chartId.startsWith('net.') && !chartId.includes('packets')) {
                    const interfaceName = chartId.replace('net.', '');
                    // Skip virtual interfaces
                    if (interfaceName.includes('lo') || interfaceName.includes('docker') || interfaceName.includes('veth')) {
                        continue;
                    }
                    try {
                        const url = `${netdataUrl}/api/v1/data?chart=${chartId}&format=json&points=1&after=-1`;
                        const dataResponse = await fetch(
                            url,
                            {
                                timeout: 3000
                            }
                        );

                        if (dataResponse.ok) {
                            const interfaceData = await dataResponse.json();
                            if (interfaceData.data && interfaceData.data.length > 0) {
                                // Netdata returns data in reverse chronological order by default when 'after' is used
                                // The latest data point will be the first one in the array
                                const latestData = interfaceData.data[0];
                                // Netdata returns [timestamp, received, sent]
                                const received = Math.abs(latestData[1]) || 0;
                                const sent = Math.abs(latestData[2]) || 0;
                                interfaces[interfaceName] = {
                                    name: interfaceName,
                                    downloadSpeed: received,
                                    uploadSpeed: sent,
                                    active: true
                                };
                            }
                        }
                    } catch (interfaceError) {
                        console.log(`Error getting data for interface ${interfaceName}:`, interfaceError.message);
                    }
                }
            }
            return {
                interfaces: interfaces,
                source: 'netdata',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.log('Netdata network stats error:', error.message);
            return {
                interfaces: {},
                source: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Get combined system information from Netdata
    async getCombinedSystemInfo() {
        const startTime = Date.now();
        
        try {
            // Get all system data from Netdata
            const [systemInfoResult, resourcesResult, temperatureResult, networkResult] = await Promise.allSettled([
                this.getBasicSystemInfo(),
                this.getResourceUsage(),
                this.getTemperature(),
                this.getNetworkStats(),
            ]);
            
            // Extract results from Promise.allSettled with better error handling
            const systemInfo = systemInfoResult.status === 'fulfilled' ? systemInfoResult.value : {
                hostname: 'unknown',
                platform: 'unknown',
                uptime: 0,
                memory: { total: 0, used: 0, free: 0 },
                cpu: { cores: 1, model: 'Unknown' },
                source: 'fallback'
            };
            
            const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : {
                cpu: { usage: 0 },
                memory: { total: 0, used: 0, free: 0, percentage: 0 },
                disk: { total: 0, used: 0, available: 0, percentage: 0 },
                source: 'fallback'
            };
            
            const temperature = temperatureResult.status === 'fulfilled' ? temperatureResult.value : {
                cpu: null
            };
            
            const network = networkResult.status === 'fulfilled' ? networkResult.value : {
                interfaces: {},
                source: 'fallback',
                error: 'Network monitoring unavailable'
            };
            
            // Log any failed promises for debugging
            if (systemInfoResult.status === 'rejected') {
                console.error('System info failed:', systemInfoResult.reason);
            }
            if (resourcesResult.status === 'rejected') {
                console.error('Resources failed:', resourcesResult.reason);
            }
            if (temperatureResult.status === 'rejected') {
                console.error('Temperature failed:', temperatureResult.reason);
            }
            if (networkResult.status === 'rejected') {
                console.error('Network failed:', networkResult.reason);
            }
            
            // Transform network data for frontend compatibility
            let transformedNetwork = null;
            if (network && network.interfaces) {
                const filteredInterfaces = Object.values(network.interfaces)
                    .filter(iface => 
                        iface.name !== 'total' && 
                        iface.name !== 'Total Network' && 
                        !iface.name.includes('veth') &&
                        iface.name !== 'docker0'
                    )
                    .map(iface => ({
                        name: iface.name,
                        downloadSpeed: iface.downloadSpeed || 0,
                        uploadSpeed: iface.uploadSpeed || 0,
                        active: iface.active || false
                    }));
                
                transformedNetwork = {
                    interfaces: filteredInterfaces,
                    source: network.source || 'netdata',
                    timestamp: network.timestamp || new Date().toISOString()
                };
            } else {
                transformedNetwork = {
                    interfaces: [],
                    source: 'unavailable',
                    timestamp: new Date().toISOString()
                };
            }

            const executionTime = Date.now() - startTime;
            
            // Return combined system information optimized for Netdata
            const combinedSystemInfo = {
                system: {
                    hostname: systemInfo.hostname,
                    platform: systemInfo.platform,
                    uptime: systemInfo.uptime,
                    source: systemInfo.source || 'netdata'
                },
                resources: {
                    cpu: {
                        usage: resources.cpu.usage,
                        cores: systemInfo.cpu.cores,
                        model: systemInfo.cpu.model
                    },
                    memory: {
                        total: resources.memory.total,
                        used: resources.memory.used,
                        free: resources.memory.free,
                        percentage: resources.memory.percentage,
                        cached: resources.memory.cached || 0,
                        buffers: resources.memory.buffers || 0
                    },
                    disk: {
                        total: resources.disk.total,
                        used: resources.disk.used,
                        available: resources.disk.available,
                        percentage: resources.disk.percentage,
                        filesystem: resources.disk.filesystem || '/',
                        mountPoint: resources.disk.mountPoint || '/'
                    }
                },
                temperature: temperature,
                network: transformedNetwork,
                executionTime: executionTime,
                timestamp: new Date().toISOString(),
                dataSource: 'netdata'
            };
            return combinedSystemInfo;
        } catch (error) {
            console.error('Combined system info error:', error);
            const executionTime = Date.now() - startTime;

            const combinedSystemInfo = {
                system: {
                    hostname: 'unknown',
                    platform: 'unknown',
                    uptime: 0,
                    source: 'error'
                },
                resources: {
                    cpu: { usage: 0, cores: 1, model: 'Unknown' },
                    memory: { total: 0, used: 0, free: 0, percentage: 0, cached: 0, buffers: 0 },
                    disk: { total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' }
                },
                temperature: {
                    cpu: { main: null, cores: [], max: null },
                    system: { source: 'error', message: 'System monitoring unavailable' }
                },
                network: {
                    interfaces: [],
                    source: 'error',
                    timestamp: new Date().toISOString()
                },
                executionTime: executionTime,
                timestamp: new Date().toISOString(),
                dataSource: 'error',
                error: error.message
            };
            return combinedSystemInfo;
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
