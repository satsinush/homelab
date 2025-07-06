// src/App.jsx
import React, { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import WakeOnLAN from './components/WakeOnLAN';
import SystemResources from './components/SystemResources';
import PackageManager from './components/PackageManager';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'wol':
        return <WakeOnLAN />;
      case 'resources':
        return <SystemResources />;
      case 'packages':
        return <PackageManager />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {renderActiveComponent()}
      </main>
    </div>
  );
}

export default App;