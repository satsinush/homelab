// src/components/Navigation.jsx
import React from 'react';
import './Navigation.css';

const Navigation = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'wol', label: 'Wake-on-LAN', icon: '⚡' },
        { id: 'resources', label: 'Resources', icon: '💻' },
        { id: 'packages', label: 'Packages', icon: '📦' },
        { id: 'settings', label: 'Settings', icon: '⚙️' }
    ];

    return (
        <nav className="navigation">
            <div className="nav-header">
                <div className="nav-logo">
                    <span className="nav-icon">🏠</span>
                    <h2>Homelab Admin</h2>
                </div>
            </div>
            <ul className="nav-tabs">
                {tabs.map(tab => (
                    <li key={tab.id} className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}>
                        <button onClick={() => setActiveTab(tab.id)}>
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Navigation;
