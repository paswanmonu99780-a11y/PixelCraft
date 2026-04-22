import React, { useState, useEffect } from 'react';
import { fetchUserCreditsData } from '../utils/api';
import './CreditsDisplay.css';

const CreditsDisplay = ({ userToken, isPremium }) => {
  const [userData, setUserData] = useState({
    credits: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userToken) {
      loadUserData();
    }
  }, [userToken]);

  const loadUserData = async () => {
    try {
      const data = await fetchUserCreditsData(userToken);
      setUserData({ credits: data.credits });
    } catch (err) {
      console.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="credits-display">
  <div className="credit-item">
        <span className="credit-icon">⚡</span>
        <div className="credit-info">
          <span className="credit-value">{userData.credits}</span>
          <span className="credit-label">Credits</span>
        </div>
      </div>

      {isPremium && (
        <div className="daily-limit unlimited">
          <span className="premium-badge">⭐ Premium</span>
          <span className="premium-text">Unlimited</span>
        </div>
      )}
    </div>
  );
};

export default CreditsDisplay;
