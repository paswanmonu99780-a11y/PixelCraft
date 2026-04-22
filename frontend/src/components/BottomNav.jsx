import React from 'react';
import { Sparkles, Compass, Clock, User } from 'lucide-react';
import './BottomNav.css';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'generate', icon: Sparkles, label: 'Create' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'history', icon: Clock, label: 'History' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}
        >
          <item.icon size={24} strokeWidth={2.5} />
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;

