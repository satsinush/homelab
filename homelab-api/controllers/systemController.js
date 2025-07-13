const { exec } = require('child_process');
const os = require('os');
const axios = require('axios');
const Settings = require('../models/Settings');
const config = require('../config');

class SystemController {
    constructor() {
        this.settingsModel = new Settings();
    }

    // Health check (no auth required)
    async healthCheck(req, res) {
        try {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                platform: os.platform(),
                hostname: os.hostname(),
                version: '1.0.0'
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get server settings
    async getSettings(req, res) {
        try {
            const settings = this.settingsModel.get();
            res.json({ settings: settings });
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({ error: 'Failed to get settings' });
        }
    }

    // Update server settings
    async updateSettings(req, res) {
        try {
            const updatedSettings = this.settingsModel.update(req.body);
            res.json({ message: 'Settings updated successfully', settings: updatedSettings });
        } catch (error) {
            console.error('Update settings error:', error);
            res.status(500).json({ error: `Failed to update settings: ${error.message}` });
        }
    }

    // Get system information
    async getSystemInfo(req, res) {
        try {
            const systemInfo = await this.getCombinedSystemInfo();
            res.json(systemInfo);
        } catch (error) {
            console.error('Get system info error:', error);
            res.status(500).json({ 
                error: 'Failed to get system information',
                details: error.message 
            });
        }
    }

    // Get package information
    async getPackages(req, res) {
        try {
            const packageInfo = await this.getPackageInfo();
            res.json(packageInfo);
        } catch (error) {
            console.error('Get packages error:', error);
            res.status(500).json({ 
                error: 'Failed to fetch package information',
                details: error.message 
            });
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
        const services = this.settingsModel.getServices();
        
        const serviceStatuses = await Promise.all(services.map(service => {
            return new Promise((serviceResolve) => {
                exec(`systemctl is-active ${service.name}`, (error, stdout) => {
                    const status = stdout.trim();
                    const active = status === 'active';
                    serviceResolve({
                        name: service.name,
                        displayName: service.displayName || service.name,
                        status: status,
                        active: active
                    });
                });
            });
        }));
        
        return { services: serviceStatuses };
    }

    // Get network statistics from Netdata
    async getNetworkStats() {
        try {
            // This would be implemented based on the existing Netdata integration
            // For now, return null to maintain compatibility
            return null;
        } catch (error) {
            console.error('Network stats error:', error);
            return null;
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
            const services = servicesResult.status === 'fulfilled' ? servicesResult.value : { services: [] };
            const network = networkResult.status === 'fulfilled' ? networkResult.value : null;
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                system: systemInfo,
                resources: {
                    ...resources,
                    network: network
                },
                temperature: temperature,
                services: services,
                network: network,
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
            exec('pacman -Qe', { timeout: 30000 }, (error, stdout, stderr) => {
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
            exec('stat -c %Y /var/lib/pacman/sync/core.db', { timeout: 10000 }, (error, stdout, stderr) => {
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
}

module.exports = SystemController;
