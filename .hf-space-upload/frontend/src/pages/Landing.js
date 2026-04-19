import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import heroArtwork from '../assets/media-studio-hero.png';
import '../styles/Landing.css';

const featureItems = [
  {
    label: 'Create',
    title: 'Image + video workflow',
    description: 'Generate images, build short videos, and animate uploads from the same dashboard.',
  },
  {
    label: 'Share',
    title: 'Explore-ready publishing',
    description: 'Push your best image outputs into the community feed without leaving your studio.',
  },
  {
    label: 'Profile',
    title: 'Creator identity',
    description: 'Keep your profile picture, public presence, and gallery presentation feeling personal.',
  },
  {
    label: 'Flow',
    title: 'Fast creative loop',
    description: 'Prompt, preview, regenerate, download, and publish with less friction between steps.',
  },
];

const Landing = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    document.documentElement.style.colorScheme = prefersDark ? 'dark' : 'light';
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    document.documentElement.style.colorScheme = nextMode ? 'dark' : 'light';
  };

  return (
    <div className={`landing-container ${isDarkMode ? 'dark' : 'light'}`}>
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-pill">Nova Canvas</span>
          <h1>AI media studio for creators who ship fast</h1>
        </div>
        <div className="nav-links">
          <button type="button" className="theme-toggle" onClick={toggleDarkMode}>
            {isDarkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <Link to="/explore" className="nav-link">Explore</Link>
          <Link to="/login" className="nav-link">Log In</Link>
          <Link to="/signup" className="cta-button">Get Started</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <p className="hero-kicker">Prompt to image. Prompt to motion. Profile to publish.</p>
          <h2 className="hero-title">Turn ideas into images, animation, and public creator moments</h2>
          <p className="hero-subtitle">
            Build stills and motion concepts, keep your creator profile polished, and publish strong visuals to
            the Explore feed from one clean workflow.
          </p>

          <div className="hero-stats" aria-label="Platform highlights">
            <div className="hero-stat">
              <strong>3 modes</strong>
              <span>image, text-to-video, image-to-video</span>
            </div>
            <div className="hero-stat">
              <strong>1 studio</strong>
              <span>generate, export, and share in one place</span>
            </div>
          </div>

          <div className="hero-buttons">
            <Link to="/signup" className="btn btn-primary">Start Creating</Link>
            <Link to="/explore" className="btn btn-secondary">Explore Gallery</Link>
            <a href="#features" className="btn btn-ghost">See Features</a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-card">
            <img
              src={heroArtwork}
              alt="Preview artwork showing the AI media studio dashboard with image, video, profile, and publishing tools"
              className="hero-artwork"
            />
            <div className="hero-float-badge badge-top">Creator dashboard</div>
            <div className="hero-float-badge badge-middle">Image + video flow</div>
            <div className="hero-float-badge badge-bottom">Profile + publish</div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="section-heading">
          <p className="section-kicker">Why creators like it</p>
          <h2>Built for making, refining, and sharing without changing tools every minute</h2>
        </div>

        <div className="features-grid">
          {featureItems.map((item) => (
            <article key={item.title} className="feature-card">
              <div className="feature-icon">{item.label}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 Nova Canvas. Create bold visuals, motion concepts, and a stronger public creator identity.</p>
      </footer>
    </div>
  );
};

export default Landing;
