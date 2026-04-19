import React from 'react';
import '../styles/Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, onLogout, user }) => {
  const menuItems = [
    { id: 'generate', label: 'Create Media', icon: 'GEN' },
    { id: 'history', label: 'History', icon: 'HIS' },
    { id: 'community', label: 'Community', icon: 'EXP' },
    { id: 'profile', label: 'Profile', icon: 'YOU' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <p className="sidebar-kicker">Creator Suite</p>
        <h2>Nova Canvas</h2>
        <span className="sidebar-subtitle">Sharper visuals. Cleaner workflow.</span>
        <div className="sidebar-token-chip">{user?.tokenBalance ?? 0} tokens</div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button className="logout-btn" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
};

export default Sidebar;
