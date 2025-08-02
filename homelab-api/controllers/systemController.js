const { exec } = require('child_process');
const os = require('os');
const Settings = require('../models/Settings');
const config = require('../config');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class SystemController {
    constructor() {
        this.settingsModel = new Settings();
    }

    // Health check (no auth required)
    async healthCheck(req, res) {
        try {
            return sendSuccess(res, { 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                platform: os.platform(),
                hostname: os.hostname(),
                version: '1.0.0'
            });
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

    // Get basic system information
    async getBasicSystemInfo() {
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: Math.floor(os.uptime()),
            loadavg: os.loadavg(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            cpus: os.cpus(),
            memory: {
                total: os.totalmem(),
                used: os.totalmem() - os.freemem(),
                free: os.freemem()
            }
        };
    }

    // Get resource usage
    async getResourceUsage() {
        return new Promise((resolve) => {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            
            // Get disk usage
            exec('df /', (error, stdout) => {
                let diskInfo = { total: 0, used: 0, free: 0, percentage: 0 };
                
                if (!error && stdout) {
                    const lines = stdout.trim().split('\n');
                    if (lines.length > 1) {
                        const diskLine = lines[1].split(/\s+/);
                        if (diskLine.length >= 4) {
                            const total = parseInt(diskLine[1]) * 1024; // Convert from KB to bytes
                            const used = parseInt(diskLine[2]) * 1024;
                            const available = parseInt(diskLine[3]) * 1024;
                            const percentage = Math.round((used / total) * 100);
                            
                            diskInfo = {
                                total: total,
                                used: used,
                                free: available,
                                percentage: percentage
                            };
                        }
                    }
                }
                
                const resources = {
                    cpu: {
                        usage: Math.round(loadAvg[0] * 100 / cpus.length),
                        cores: cpus.length,
                        loadAvg: loadAvg
                    },
                    memory: {
                        total: totalMem,
                        used: usedMem,
                        free: freeMem,
                        percentage: Math.round((usedMem / totalMem) * 100)
                    },
                    disk: diskInfo
                };
                
                resolve(resources);
            });
        });
    }

    // Get temperature information
    async getTemperature() {
        return new Promise((resolve) => {
            exec('vcgencmd measure_temp', (error, stdout) => {
                if (error) {
                    resolve({ cpu: 'N/A', gpu: 'N/A' });
                } else {
                    const temp = stdout.match(/temp=([0-9.]+)/);
                    resolve({
                        cpu: temp ? parseFloat(temp[1]) : 'N/A',
                        gpu: 'N/A'
                    });
                }
            });
        });
    }

    // Get service statuses
    async getServices() {
        // Use systemctl to list all services with state and preset, and check if active
        return new Promise((resolve) => {
            exec('systemctl list-unit-files --type=service --no-legend', async (error, stdout) => {
                if (error) {
                    console.error('Failed to list services:', error);
                    resolve([]);
                    return;
                }
                const lines = stdout.trim().split('\n');
                // Each line: UNIT FILE [STATE] [PRESET]
                const services = await Promise.all(
                    lines
                        .map(line => {
                            // Split by whitespace, but allow spaces in UNIT FILE
                            // The last two columns are STATE and PRESET, rest is UNIT FILE
                            const parts = line.trim().split(/\s+/);
                            if (parts.length < 2) return null;
                            const preset = parts.length > 2 ? parts.pop() : '';
                            const state = parts.pop();
                            const name = parts.join(' ');
                            return { name, state, preset };
                        })
                        .filter(Boolean)
                        .map(async service => {
                            // Check if the service is active
                            return new Promise(resolveActive => {
                                exec(`systemctl is-active ${service.name}`, (err, activeStdout) => {
                                    service.active = !err && activeStdout.trim() === 'active';
                                    resolveActive(service);
                                });
                            });
                        })
                );
                resolve(services);
            });
        });
    }

    // Get network statistics from Netdata
    async getNetworkStats() {
        try {
            // Only use netdata for network statistics
            const netdataStats = await this.getNetdataNetworkStats();
            if (netdataStats) {
                return netdataStats;
            } else {
                // Return empty result if Netdata is not available
                console.log('Netdata network statistics not available');
                return {
                    interfaces: {},
                    source: 'unavailable',
                    timestamp: new Date().toISOString(),
                    message: 'Netdata service not available for network statistics'
                };
            }
        } catch (error) {
            console.error('Network stats error:', error);
            return {
                interfaces: {},
                source: 'error',
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
                    if (interfaceName.includes('lo') || interfaceName.includes('docker')) {
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

    // Get combined system information
    async getCombinedSystemInfo() {
        const startTime = Date.now();
        
        try {
            const [systemInfoResult, resourcesResult, temperatureResult, servicesResult, networkResult] = await Promise.allSettled([
                this.getBasicSystemInfo(),
                this.getResourceUsage(),
                this.getTemperature(),
                this.getServices(),
                this.getNetworkStats()
            ]);
            
            // Extract results from Promise.allSettled
            const systemInfo = systemInfoResult.status === 'fulfilled' ? systemInfoResult.value : null;
            const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
            const temperature = temperatureResult.status === 'fulfilled' ? temperatureResult.value : { cpu: 'N/A', gpu: 'N/A' };
            const services = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
            const network = networkResult.status === 'fulfilled' ? networkResult.value : null;
            
            // Transform network data for frontend compatibility
            let transformedNetwork = null;
            if (network && network.interfaces) {
                // Filter out 'total' interface for the interfaces display
                const filteredInterfaces = Object.values(network.interfaces)
                    .filter(iface => iface.name !== 'total' && iface.name !== 'Total Network')
                    .map(iface => ({
                        name: iface.name,
                        downloadSpeed: iface.downloadSpeed || 0,  // Download speed in bytes/sec
                        uploadSpeed: iface.uploadSpeed || 0,      // Upload speed in bytes/sec
                        active: iface.active || false
                    }));
                
                transformedNetwork = {
                    ...network,
                    interfaces: filteredInterfaces
                };
            }
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                system: systemInfo,
                resources: {
                    ...resources,
                    network: transformedNetwork
                },
                temperature: temperature,
                services: services,
                network: transformedNetwork,
                metadata: {
                    timestamp: new Date().toISOString(),
                    responseTime: `${responseTime}ms`,
                    endpoint: 'combined'
                }
            };
        } catch (error) {
            console.error('Combined system endpoint error:', error);
            throw error;
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
    getInstalledPackages() {
        return new Promise((resolve, reject) => {
            exec('pacman -Q', { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Package list error:', error.message);
                    reject(error);
                    return;
                }

                const packages = new Map();
                const lines = stdout.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    // pacman -Qe output format: "package-name version"
                    const match = line.match(/^(.+?)\s+(.+?)$/);
                    if (match) {
                        const [, name, version] = match;
                        packages.set(name.trim(), {
                            name: name.trim(),
                            currentVersion: version.trim(),
                            newVersion: null,
                            hasUpdate: false,
                            status: 'installed'
                        });
                    }
                }
                
                resolve(packages);
            });
        });
    }

    getPackageSyncTime() {
        return new Promise((resolve) => {
            exec('stat -c %Z /var/lib/pacman/sync/core.db', { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Package sync time error:', error.message);
                    resolve(null);
                    return;
                }
                
                const timestamp = parseInt(stdout.trim());
                if (!isNaN(timestamp)) {
                    resolve(new Date(timestamp * 1000));
                } else {
                    resolve(null);
                }
            });
        });
    }

    getAvailableUpdates() {
        return new Promise((resolve) => {
            exec('pacman -Qu', { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    // If error is just "no upgrades", that's okay
                    if (error.code === 1 && !stdout.trim()) {
                        resolve(new Map());
                        return;
                    }
                    console.error('Package update check error:', error.message);
                    resolve(new Map());
                    return;
                }

                const updates = new Map();
                const lines = stdout.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    // pacman -Qu output format: "package-name old-version -> new-version"
                    const match = line.match(/^(.+?)\s+(.+?)\s+->\s+(.+?)$/);
                    if (match) {
                        const [, name, currentVersion, newVersion] = match;
                        updates.set(name.trim(), {
                            currentVersion: currentVersion.trim(),
                            newVersion: newVersion.trim()
                        });
                    }
                }
                
                resolve(updates);
            });
        });
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
                cpu: temperature.cpu,
                gpu: temperature.gpu
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
