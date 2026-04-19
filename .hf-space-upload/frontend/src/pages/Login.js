import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import heroArtwork from '../assets/media-studio-hero.png';
import '../styles/Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.identifier, formData.password, formData.rememberMe);
      if (formData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-shell">
        <section className="auth-showcase">
          <div className="auth-showcase-copy">
            <p className="auth-kicker">Creator access</p>
            <h1>Jump back into your media studio</h1>
            <p className="auth-showcase-text">
              Continue generating images, building motion ideas, and publishing your strongest work with your
              profile front and center.
            </p>
          </div>

          <div className="auth-showcase-art">
            <img
              src={heroArtwork}
              alt="Illustration of the AI media studio dashboard"
              className="auth-hero-artwork"
            />
          </div>

          <div className="auth-highlights">
            <div className="auth-highlight-card">
              <strong>Create</strong>
              <span>Prompt into image and motion from one workspace.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>Publish</strong>
              <span>Push polished visuals into Explore when they are ready.</span>
            </div>
          </div>
        </section>

        <div className="auth-card">
          <div className="auth-card-top">
            <p className="auth-card-kicker">Welcome back</p>
            <h2>Log in</h2>
            <p className="auth-subtitle">Sign in and continue creating with the same profile and history.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email or Mobile Number</label>
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                required
                placeholder="your@email.com or +91 9876543210"
              />
              <p className="field-note">Mobile number ko country code ke saath enter karna best rahega.</p>
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="Enter your password"
              />
            </div>

            <div className="auth-footer-actions">
              <Link to="/forgot-password" className="text-link">
                Forgot password?
              </Link>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                id="rememberMe"
              />
              <label htmlFor="rememberMe">Remember me</label>
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className="auth-link">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
