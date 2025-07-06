// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
    const [systemInfo, setSystemInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_BASE_URL = 'https://admin.rpi5-server.home.arpa/api';

    useEffect(() => {
        // TODO: Fetch system info from API when endpoint is available
        // For now, showing placeholder data
        setTimeout(() => {
            setSystemInfo({
                hostname: 'rpi5-server',
                uptime: '7 days, 14 hours',
                temperature: '45°C',
                services: {
                    nginx: 'running',
                    api: 'running',
                    ssh: 'running'
                }
            });
            setLoading(false);
        }, 1000);
    }, []);

    if (loading) {
        return (
            <div className="dashboard">
                <div className="loading">Loading system information...</div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>System Overview</h1>
                <div className="status-indicator online">System Online</div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>System Info</h3>
                        <span className="card-icon">🖥️</span>
                    </div>
                    <div className="card-content">
                        <div className="info-row">
                            <span className="info-label">Hostname:</span>
                            <span className="info-value">{systemInfo?.hostname}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Uptime:</span>
                            <span className="info-value">{systemInfo?.uptime}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Temperature:</span>
                            <span className="info-value">{systemInfo?.temperature}</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>Services</h3>
                        <span className="card-icon">🔧</span>
                    </div>
                    <div className="card-content">
                        {systemInfo?.services && Object.entries(systemInfo.services).map(([service, status]) => (
                            <div key={service} className="service-row">
                                <span className="service-name">{service}</span>
                                <span className={`service-status ${status}`}>
                                    <span className="status-dot"></span>
                                    {status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>Quick Actions</h3>
                        <span className="card-icon">⚡</span>
                    </div>
                    <div className="card-content">
                        <button className="action-button">
                            <span>🔄</span>
                            Restart Services
                        </button>
                        <button className="action-button">
                            <span>📊</span>
                            View Logs
                        </button>
                        <button className="action-button">
                            <span>🔍</span>
                            System Monitor
                        </button>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>Recent Activity</h3>
                        <span className="card-icon">📋</span>
                    </div>
                    <div className="card-content">
                        <div className="activity-item">
                            <span className="activity-time">2 min ago</span>
                            <span className="activity-text">Wake-on-LAN sent to Desktop</span>
                        </div>
                        <div className="activity-item">
                            <span className="activity-time">15 min ago</span>
                            <span className="activity-text">System resources checked</span>
                        </div>
                        <div className="activity-item">
                            <span className="activity-time">1 hour ago</span>
                            <span className="activity-text">Package updates available</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
