import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import NewImageGenerator from '../components/NewImageGenerator';
import ImageHistory from '../components/ImageHistory';
import UserProfile from '../components/UserProfile';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  return (
      <div className="dashboard-container full-width">
        <div className="dashboard-content glass-card">
          <header className="dashboard-header">
            <h1 className="neon-title">PixelCraft AI</h1>
            <div className="credits-header">
              <span>⚡ Credits: {user?.credits || 20}</span>
            </div>
          </header>

          <main className="dashboard-main">
            {activeTab === 'generate' && <NewImageGenerator />}
            {activeTab === 'explore' && <div className="coming-soon">Explore Gallery<br/><small>Coming Soon</small></div>}
            {activeTab === 'history' && <ImageHistory />}
{activeTab === 'profile' && <UserProfile user={user} />}
          </main>
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
  );

};

export default Dashboard;

