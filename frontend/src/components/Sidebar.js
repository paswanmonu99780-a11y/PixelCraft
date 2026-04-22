import React from 'react';
import { 
  Sparkles, 
  Image, 
  Clock, 
} from 'lucide-react';
import '../styles/Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'generate', icon: Sparkles, label: 'Create' },
    { id: 'explore', icon: Image, label: 'Explore' },
    { id: 'history', icon: Clock, label: 'History' },
  ];


  return (
    <aside className="sidebar glass-card">
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-btn ${activeTab === item.id ? 'active glow-btn' : ''}`}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
          >
            <item.icon size={24} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

