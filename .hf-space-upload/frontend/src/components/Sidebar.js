import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import '../styles/Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const menuItems = [
    { id: 'generate', icon: 'GEN' },
    { id: 'history', icon: 'HIS' },
    { id: 'community', icon: 'EXP' },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <Menu size={20} />
      </button>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            title={item.id.charAt(0).toUpperCase() + item.id.slice(1)}
          >
            <span className="icon">{item.icon}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;