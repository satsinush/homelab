const config = require('../config');

class NetdataService {
    constructor() {
        this.baseUrl = config.netdata?.url || 'http://localhost:19999';
        this.timeout = 5000; // 5 second timeout
    }

    // Get system info from Netdata
    async getSystemInfo() {
        try {
            // Get basic system info using available charts
            const [uptimeData, memData] = await Promise.allSettled([
                this.getMetric('system.uptime'),
                this.getMetric('system.ram')
            ]);

            const uptime = uptimeData.status === 'fulfilled' && uptimeData.value?.data?.[0]?.[1] ? uptimeData.value.data[0][1] : 0;
            const memory = memData.status === 'fulfilled' && memData.value?.data?.[0] ? {
                total: (memData.value.data[0][1] + memData.value.data[0][2] + memData.value.data[0][3] + memData.value.data[0][4]) * 1024 * 1024,
                used: memData.value.data[0][1] * 1024 * 1024,
                free: (memData.value.data[0][2] + memData.value.data[0][3] + memData.value.data[0][4]) * 1024 * 1024
            } : { total: 0, used: 0, free: 0 };

            // Get hostname from OS or fallback
            const hostname = process.env.HOSTNAME || 'netdata-host';

            return {
                hostname,
                platform: 'linux', // Netdata typically runs on Linux
                uptime: Math.floor(uptime),
                memory,
                cpu: { cores: 1, model: 'Unknown' },
                source: 'netdata'
            };
        } catch (error) {
            console.error('Netdata system info error:', error);
            throw new Error('Failed to fetch system info from Netdata');
        }
    }

    // Get CPU usage from Netdata
    async getCpuUsage() {
        try {
            const url = new URL(`${this.baseUrl}/api/v1/data`);
            url.searchParams.set('chart', 'system.cpu');
            url.searchParams.set('points', '1');
            url.searchParams.set('group', 'average');
            url.searchParams.set('format', 'json');
            url.searchParams.set('after', '-1');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && data.data && data.data.length > 0 && Array.isArray(data.labels)) {
                const cpuData = data.data[0];

                let total = 0;

                for (let i = 1; i < cpuData.length; i++) {
                    total += cpuData[i] || 0;
                }

                const usage = Math.min(100, Math.max(0, total));

                return {
                    usage,
                    timestamp: cpuData[0]
                };
            }

            return { usage: 0, used: 0, total: 0, timestamp: Date.now() / 1000 };
        } catch (error) {
            console.error('Netdata CPU usage error:', error);
            return { usage: 0, used: 0, total: 0, timestamp: Date.now() / 1000 };
        }
    }

    // Get memory usage from Netdata
    async getMemoryUsage() {
        try {
            const url = new URL(`${this.baseUrl}/api/v1/data`);
            url.searchParams.set('chart', 'system.ram');
            url.searchParams.set('points', '1');
            url.searchParams.set('group', 'average');
            url.searchParams.set('format', 'json');
            url.searchParams.set('after', '-1');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && data.data && data.data.length > 0) {
                const memData = data.data[0];
                // Netdata memory data: [timestamp, used, cached, buffers, free]
                const used = (memData[1] || 0) * 1024 * 1024; // Convert MB to bytes
                const cached = (memData[2] || 0) * 1024 * 1024;
                const buffers = (memData[3] || 0) * 1024 * 1024;
                const free = (memData[4] || 0) * 1024 * 1024;
                const total = used + cached + buffers + free;
                
                return {
                    total,
                    used,
                    free: free + cached + buffers, // Available memory
                    cached,
                    buffers,
                    percentage: total > 0 ? Math.round((used / total) * 100) : 0
                };
            }
            
            return { total: 0, used: 0, free: 0, cached: 0, buffers: 0, percentage: 0 };
        } catch (error) {
            console.error('Netdata memory usage error:', error);
            return { total: 0, used: 0, free: 0, cached: 0, buffers: 0, percentage: 0 };
        }
    }

    // Get disk usage from Netdata
    async getDiskUsage() {
        try {
            // Use the correct chart name from your Netdata instance
            const url = new URL(`${this.baseUrl}/api/v1/data`);
            url.searchParams.set('chart', 'disk_space./');
            url.searchParams.set('points', '1');
            url.searchParams.set('group', 'average');
            url.searchParams.set('format', 'json');
            url.searchParams.set('after', '-1');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && data.data && data.data.length > 0) {
                const diskData = data.data[0];
                // Netdata disk space data: [timestamp, available, used, reserved]
                const available = (diskData[1] || 0) * 1024 * 1024 * 1024; // Convert GB to bytes
                const used = (diskData[2] || 0) * 1024 * 1024 * 1024;
                const reserved = (diskData[3] || 0) * 1024 * 1024 * 1024;
                const total = available + used + reserved;
                
                return {
                    total,
                    used,
                    available,
                    percentage: total > 0 ? Math.round((used / total) * 100) : 0,
                    filesystem: '/',
                    mountPoint: '/'
                };
            }
            
            // Fallback: return default values
            return { total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' };
        } catch (error) {
            console.error('Netdata disk usage error:', error);
            return { total: 0, used: 0, available: 0, percentage: 0, filesystem: '/', mountPoint: '/' };
        }
    }

    // Get network statistics from Netdata
    async getNetworkStats() {
        try {
            // Get list of network interfaces
            const chartsResponse = await fetch(`${this.baseUrl}/api/v1/charts`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!chartsResponse.ok) {
                throw new Error(`HTTP ${chartsResponse.status}: ${chartsResponse.statusText}`);
            }

            const chartsData = await chartsResponse.json();

            const networkCharts = Object.keys(chartsData.charts || {})
                .filter(chart => chart.startsWith('net.') && !chart.includes('total'))
                .slice(0, 5); // Limit to first 5 interfaces

            if (networkCharts.length === 0) {
                return { interfaces: {}, source: 'netdata', message: 'No network interfaces found' };
            }

            // Get data for each interface
            const interfacePromises = networkCharts.map(async (chart) => {
                try {
                    const url = new URL(`${this.baseUrl}/api/v1/data`);
                    url.searchParams.set('chart', chart);
                    url.searchParams.set('points', '1');
                    url.searchParams.set('group', 'average');
                    url.searchParams.set('format', 'json');
                    url.searchParams.set('after', '-1');

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(this.timeout)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();

                    if (data && data.data && data.data.length > 0) {
                        const interfaceData = data.data[0];
                        const interfaceName = chart.replace('net.', '');
                        
                        return {
                            name: interfaceName,
                            downloadSpeed: Math.abs(interfaceData[1] || 0), // Received bytes/sec
                            uploadSpeed: Math.abs(interfaceData[2] || 0), // Sent bytes/sec
                            active: (interfaceData[1] || 0) > 0 || (interfaceData[2] || 0) > 0
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`Error fetching data for ${chart}:`, error);
                    return null;
                }
            });

            const interfaces = (await Promise.all(interfacePromises))
                .filter(iface => iface !== null)
                .reduce((acc, iface) => {
                    acc[iface.name] = iface;
                    return acc;
                }, {});

            return {
                interfaces,
                source: 'netdata',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Netdata network stats error:', error);
            return { interfaces: {}, source: 'netdata', error: error.message };
        }
    }

    // Get temperature data from Netdata
    async getTemperature() {
        // Based on debug data, no temperature sensors are available in this Netdata instance
        return {
            cpu: {
                main: null,
                cores: [],
                max: null
            },
            system: {
                platform: 'linux',
                source: 'netdata',
                message: 'Temperature sensors not available on this system'
            }
        };
    }

    // Get system load average from Netdata
    async getLoadAverage() {
        try {
            const url = new URL(`${this.baseUrl}/api/v1/data`);
            url.searchParams.set('chart', 'system.load');
            url.searchParams.set('points', '1');
            url.searchParams.set('group', 'average');
            url.searchParams.set('format', 'json');
            url.searchParams.set('after', '-1');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && data.data && data.data.length > 0) {
                const loadData = data.data[0];
                return [
                    loadData[1] || 0, // 1 minute
                    loadData[2] || 0, // 5 minutes
                    loadData[3] || 0  // 15 minutes
                ];
            }
            
            return [0, 0, 0];
        } catch (error) {
            console.error('Netdata load average error:', error);
            return [0, 0, 0];
        }
    }

    // Generic method to get a specific metric with better error handling
    async getMetric(chart, dimension = null) {
        try {
            const url = new URL(`${this.baseUrl}/api/v1/data`);
            url.searchParams.set('chart', chart);
            url.searchParams.set('points', '1');
            url.searchParams.set('group', 'average');
            url.searchParams.set('format', 'json');
            url.searchParams.set('after', '-1');
            
            if (dimension) {
                url.searchParams.set('dimension', dimension);
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Netdata chart '${chart}' not found (404)`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`Netdata metric timeout for ${chart}`);
            } else {
                console.error(`Netdata metric error for ${chart}:`, error.message);
            }
            return null;
        }
    }

    // Check if Netdata is available
    async isAvailable() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/info`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

module.exports = NetdataService;
