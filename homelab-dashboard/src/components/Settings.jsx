// src/components/Settings.jsx
import React from 'react';
import './Settings.css';

const Settings = () => {
    return (
        <div className="settings">
            <div className="page-header">
                <h1>Settings</h1>
                <p>Configure your homelab dashboard</p>
            </div>

            <div className="placeholder-content">
                <div className="placeholder-icon">⚙️</div>
                <h3>Settings & Authentication</h3>
                <p>This section will include:</p>
                <ul>
                    <li>User authentication (username/password)</li>
                    <li>Dashboard theme settings</li>
                    <li>API configuration</li>
                    <li>Security settings</li>
                    <li>Backup and restore options</li>
                </ul>
                <div className="coming-soon">Coming Soon</div>
            </div>
        </div>
    );
};

export default Settings;
