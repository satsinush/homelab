// src/components/SystemResources.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SystemResources.css';

const SystemResources = () => {
    const [resources, setResources] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const API_BASE_URL = 'https://admin.rpi5-server.home.arpa/api';

    useEffect(() => {
        const fetchResources = async () => {
            try {
                // TODO: Replace with actual API call when endpoint is available
                // const response = await axios.get(`${API_BASE_URL}/resources`);
                // setResources(response.data);

                // Placeholder data for now
                setTimeout(() => {
                    setResources({
                        cpu: {
                            usage: Math.floor(Math.random() * 50) + 10,
                            cores: 4,
                            frequency: '1.8 GHz'
                        },
                        memory: {
                            used: Math.floor(Math.random() * 2000) + 1000,
                            total: 8192,
                            cached: Math.floor(Math.random() * 500) + 200
                        },
                        disk: {
                            used: Math.floor(Math.random() * 20000) + 10000,
                            total: 64000,
                            filesystem: '/dev/mmcblk0p2'
                        },
                        network: {
                            rx: Math.floor(Math.random() * 1000) + 100,
                            tx: Math.floor(Math.random() * 500) + 50,
                            interface: 'eth0'
                        },
                        temperature: {
                            cpu: Math.floor(Math.random() * 20) + 40,
                            gpu: Math.floor(Math.random() * 15) + 35
                        }
                    });
                    setLoading(false);
                }, 1000);
            } catch (error) {
                console.error('Error fetching resources:', error);
                setLoading(false);
            }
        };

        fetchResources();

        let interval;
        if (autoRefresh) {
            interval = setInterval(fetchResources, 5000); // Refresh every 5 seconds
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getUsageColor = (percentage) => {
        if (percentage < 50) return '#10b981';
        if (percentage < 80) return '#f59e0b';
        return '#ef4444';
    };

    if (loading) {
        return (
            <div className="resources-container">
                <div className="loading">
                    <div className="loading-spinner"></div>
                    <span>Loading system resources...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="resources-container">
            <div className="resources-header">
                <h1>System Resources</h1>
                <div className="header-controls">
                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span>Auto-refresh (5s)</span>
                    </label>
                    <button
                        className="refresh-button"
                        onClick={() => window.location.reload()}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            <div className="resources-grid">
                {/* CPU Usage */}
                <div className="resource-card">
                    <div className="card-header">
                        <h3>CPU Usage</h3>
                        <span className="card-icon">🖥️</span>
                    </div>
                    <div className="card-content">
                        <div className="usage-display">
                            <div className="usage-percentage">{resources?.cpu?.usage}%</div>
                            <div
                                className="usage-bar"
                                style={{
                                    '--usage-width': `${resources?.cpu?.usage}%`,
                                    '--usage-color': getUsageColor(resources?.cpu?.usage)
                                }}
                            >
                                <div className="usage-fill"></div>
                            </div>
                        </div>
                        <div className="resource-details">
                            <div className="detail-row">
                                <span>Cores:</span>
                                <span>{resources?.cpu?.cores}</span>
                            </div>
                            <div className="detail-row">
                                <span>Frequency:</span>
                                <span>{resources?.cpu?.frequency}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="resource-card">
                    <div className="card-header">
                        <h3>Memory</h3>
                        <span className="card-icon">💾</span>
                    </div>
                    <div className="card-content">
                        <div className="usage-display">
                            <div className="usage-percentage">
                                {Math.round((resources?.memory?.used / resources?.memory?.total) * 100)}%
                            </div>
                            <div
                                className="usage-bar"
                                style={{
                                    '--usage-width': `${(resources?.memory?.used / resources?.memory?.total) * 100}%`,
                                    '--usage-color': getUsageColor((resources?.memory?.used / resources?.memory?.total) * 100)
                                }}
                            >
                                <div className="usage-fill"></div>
                            </div>
                        </div>
                        <div className="resource-details">
                            <div className="detail-row">
                                <span>Used:</span>
                                <span>{formatBytes(resources?.memory?.used * 1024 * 1024)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Total:</span>
                                <span>{formatBytes(resources?.memory?.total * 1024 * 1024)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Cached:</span>
                                <span>{formatBytes(resources?.memory?.cached * 1024 * 1024)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disk Usage */}
                <div className="resource-card">
                    <div className="card-header">
                        <h3>Disk Usage</h3>
                        <span className="card-icon">💿</span>
                    </div>
                    <div className="card-content">
                        <div className="usage-display">
                            <div className="usage-percentage">
                                {Math.round((resources?.disk?.used / resources?.disk?.total) * 100)}%
                            </div>
                            <div
                                className="usage-bar"
                                style={{
                                    '--usage-width': `${(resources?.disk?.used / resources?.disk?.total) * 100}%`,
                                    '--usage-color': getUsageColor((resources?.disk?.used / resources?.disk?.total) * 100)
                                }}
                            >
                                <div className="usage-fill"></div>
                            </div>
                        </div>
                        <div className="resource-details">
                            <div className="detail-row">
                                <span>Used:</span>
                                <span>{formatBytes(resources?.disk?.used * 1024 * 1024)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Total:</span>
                                <span>{formatBytes(resources?.disk?.total * 1024 * 1024)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Filesystem:</span>
                                <span>{resources?.disk?.filesystem}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Network Activity */}
                <div className="resource-card">
                    <div className="card-header">
                        <h3>Network</h3>
                        <span className="card-icon">🌐</span>
                    </div>
                    <div className="card-content">
                        <div className="network-stats">
                            <div className="network-stat">
                                <div className="stat-label">↓ RX</div>
                                <div className="stat-value">{formatBytes(resources?.network?.rx * 1024)}/s</div>
                            </div>
                            <div className="network-stat">
                                <div className="stat-label">↑ TX</div>
                                <div className="stat-value">{formatBytes(resources?.network?.tx * 1024)}/s</div>
                            </div>
                        </div>
                        <div className="resource-details">
                            <div className="detail-row">
                                <span>Interface:</span>
                                <span>{resources?.network?.interface}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Temperature */}
                <div className="resource-card">
                    <div className="card-header">
                        <h3>Temperature</h3>
                        <span className="card-icon">🌡️</span>
                    </div>
                    <div className="card-content">
                        <div className="temperature-display">
                            <div className="temp-item">
                                <div className="temp-label">CPU</div>
                                <div className="temp-value">{resources?.temperature?.cpu}°C</div>
                            </div>
                            <div className="temp-item">
                                <div className="temp-label">GPU</div>
                                <div className="temp-value">{resources?.temperature?.gpu}°C</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemResources;
