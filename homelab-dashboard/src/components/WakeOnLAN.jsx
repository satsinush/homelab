// src/components/WakeOnLAN.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WakeOnLAN.css';

const WakeOnLAN = () => {
    const [devices, setDevices] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const API_BASE_URL = 'https://admin.rpi5-server.home.arpa/api';

    useEffect(() => {
        // Fetch devices from the Node.js API on component mount
        axios.get(`${API_BASE_URL}/devices`)
            .then(response => {
                setDevices(response.data);
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to fetch devices. Is the Node.js API running?');
                console.error('Error fetching devices:', err);
                setLoading(false);
            });
    }, []);

    const handleWakeOnLan = async (deviceName) => {
        setMessage('');
        setError('');
        try {
            const response = await axios.post(`${API_BASE_URL}/wol`, { device: deviceName });
            setMessage(`Wake-on-LAN packet sent to ${deviceName} successfully!`);
        } catch (err) {
            setError(`Failed to send WoL packet to ${deviceName}.`);
            console.error('WoL error:', err.response ? err.response.data : err.message);
        }
    };

    const clearMessages = () => {
        setMessage('');
        setError('');
    };

    return (
        <div className="wol-container">
            <div className="wol-header">
                <h1>Wake-on-LAN</h1>
                <p>Send wake-up packets to devices on your network</p>
            </div>

            {(message || error) && (
                <div className="message-container">
                    {error && (
                        <div className="message error">
                            <span className="message-icon">❌</span>
                            <span className="message-text">{error}</span>
                            <button className="message-close" onClick={clearMessages}>×</button>
                        </div>
                    )}
                    {message && (
                        <div className="message success">
                            <span className="message-icon">✅</span>
                            <span className="message-text">{message}</span>
                            <button className="message-close" onClick={clearMessages}>×</button>
                        </div>
                    )}
                </div>
            )}

            <div className="wol-content">
                {loading ? (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <span>Loading devices...</span>
                    </div>
                ) : devices.length > 0 ? (
                    <div className="devices-grid">
                        {devices.map(device => (
                            <div key={device} className="device-card">
                                <div className="device-info">
                                    <div className="device-icon">💻</div>
                                    <div className="device-details">
                                        <h3 className="device-name">{device}</h3>
                                        <p className="device-status">Status: Unknown</p>
                                    </div>
                                </div>
                                <button
                                    className="wake-button"
                                    onClick={() => handleWakeOnLan(device)}
                                >
                                    <span className="button-icon">⚡</span>
                                    Wake Up
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-devices">
                        <div className="no-devices-icon">📱</div>
                        <h3>No Devices Found</h3>
                        <p>No devices are configured for Wake-on-LAN or failed to load devices.</p>
                    </div>
                )}
            </div>

            <div className="wol-info">
                <h3>About Wake-on-LAN</h3>
                <p>
                    Wake-on-LAN allows you to remotely wake up computers and devices on your network.
                    Devices must be configured to accept WoL packets and be connected via Ethernet.
                </p>
            </div>
        </div>
    );
};

export default WakeOnLAN;
