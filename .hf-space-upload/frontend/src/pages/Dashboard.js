import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ImageGenerator from '../components/ImageGenerator';
import ImageHistory from '../components/ImageHistory';
import PublicGallery from '../components/PublicGallery';
import UserProfile from '../components/UserProfile';
import {
  ASSISTANT_ACTION_EVENT_NAME,
  clearPendingAssistantAction,
  readPendingAssistantAction,
} from '../utils/assistantActions';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const navigate = useNavigate();

  const dashboardCopy = {
    generate: {
      eyebrow: '',
      title: '',
      subtitle: '',
    },
    history: {
      eyebrow: 'History',
      title: 'Your generated images',
      subtitle: 'Review previous results and revisit strong prompts.',
    },
    community: {
      eyebrow: 'Community',
      title: 'Share and discover',
      subtitle: 'Publish images, browse the feed',
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Account settings',
      subtitle: 'Manage your profile and token balance.',
    },
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const applyAssistantAction = (action) => {
      if (!action?.type) {
        return;
      }

      if (action.tab) {
        setActiveTab(action.tab);
      } else if (action.type === 'generate-image' || action.type === 'generate-video') {
        setActiveTab('generate');
      }

      if (action.type === 'dashboard-tab') {
        clearPendingAssistantAction(action.id);
      }
    };

    applyAssistantAction(readPendingAssistantAction());

    const handleAssistantAction = (event) => {
      applyAssistantAction(event.detail);
    };

    window.addEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);

    return () => {
      window.removeEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);
    };
  }, []);

  const handleOpenProfile = () => {
    setActiveTab('profile');
  };

  const headerCopy = dashboardCopy[activeTab] || dashboardCopy.generate;

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div className="dashboard-title-group">
            {headerCopy.eyebrow && <p className="dashboard-eyebrow">{headerCopy.eyebrow}</p>}
            {headerCopy.title && <h1>{headerCopy.title}</h1>}
            {headerCopy.subtitle && <p className="dashboard-subtitle">{headerCopy.subtitle}</p>}
          </div>
          <button
            type="button"
            className="user-info user-badge user-badge-button"
            onClick={handleOpenProfile}
            aria-label="Open profile"
            title="Open profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.username || 'Creator'} className="user-avatar-chip" />
            ) : (
              <div className="user-avatar-chip fallback-avatar">
                {(user?.username || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="dashboard-user-copy">
              <strong>{user?.username || 'Creator'}</strong>
              <em className="dashboard-token-balance">{user?.tokenBalance ?? 0} tokens</em>
            </div>
          </button>
        </header>

        <main className="dashboard-main">
          {activeTab === 'generate' && <ImageGenerator />}
          {activeTab === 'history' && <ImageHistory />}
          {activeTab === 'community' && (
            <PublicGallery
              showComposer
              title="Community"
              subtitle="Share images, browse the feed"
            />
          )}
          {activeTab === 'profile' && <UserProfile user={user} />}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
