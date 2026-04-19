import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PublicGallery from '../components/PublicGallery';
import '../styles/Explore.css';

const Explore = () => {
  const { token } = useAuth();

  return (
    <div className="explore-page">
      <header className="explore-header">
        <Link to="/" className="explore-brand">
          AI Image Generator
        </Link>
        <div className="explore-actions">
          {token ? (
            <Link to="/dashboard" className="explore-link">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="explore-link">
                Log In
              </Link>
              <Link to="/signup" className="explore-cta">
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="explore-main">
        <PublicGallery
          title="Explore Public Images"
          subtitle="Search public uploads and generated images from creators across the platform"
        />
      </main>
    </div>
  );
};

export default Explore;
