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
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const navigate = useNavigate();

  const dashboardCopy = {
    generate: {
      eyebrow: 'Creative Studio',
      title: 'Create image drops and motion ideas',
      subtitle: 'Build polished media, test prompts faster, and export your favorite results without leaving the studio.',
    },
    history: {
      eyebrow: 'Archive',
      title: 'Track every generated frame',
      subtitle: 'Review previous results, revisit strong prompts, and keep your best visual directions close at hand.',
    },
    community: {
      eyebrow: 'Community',
      title: 'Share work and explore creators',
      subtitle: 'Publish standout images, browse what others are making, and keep the feedback loop alive.',
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Keep your studio identity tidy',
      subtitle: 'Manage your account details and make sure your creator profile stays ready for sharing.',
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenProfile = () => {
    setActiveTab('profile');
  };

  const headerCopy = dashboardCopy[activeTab] || dashboardCopy.generate;

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div className="dashboard-title-group">
            <p className="dashboard-eyebrow">{headerCopy.eyebrow}</p>
            <h1>{headerCopy.title}</h1>
            <p className="dashboard-subtitle">{headerCopy.subtitle}</p>
          </div>
          <button
            type="button"
            className="user-info user-badge user-badge-button"
            onClick={handleOpenProfile}
            aria-label="Open profile"
            title="Open profile"
          >
            <div className="dashboard-presence">
              <span className="dashboard-presence-dot"></span>
              Studio online
            </div>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.username || 'Creator'} className="user-avatar-chip" />
            ) : (
              <div className="user-avatar-chip fallback-avatar">
                {(user?.username || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="dashboard-user-copy">
              <strong>{user?.username || 'Creator'}</strong>
              <span>{user?.contactValue || 'Creative account'}</span>
            </div>
          </button>
        </header>

        <main className="dashboard-main">
          {activeTab === 'generate' && <ImageGenerator />}
          {activeTab === 'history' && <ImageHistory />}
          {activeTab === 'community' && (
            <PublicGallery
              showComposer
              title="Creator Community"
              subtitle="Upload images, publish your work, and search the public feed"
            />
          )}
          {activeTab === 'profile' && <UserProfile user={user} />}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
