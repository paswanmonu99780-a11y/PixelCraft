import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="auth-card">
          <div className="auth-card-top">
            <p className="auth-card-kicker">Welcome back</p>
            <h2>Log in</h2>
            <p className="auth-subtitle">Sign in and continue creating with the same profile and history.</p>
          </div>

          {error && (
            <div className={`error-message ${error.includes('not found') || error.includes('not activated') ? 'error-message--alt' : ''}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email or Mobile Number</label>
               <input
                 type="text"
                 name="identifier"
                 value={formData.identifier}
                 onChange={handleInputChange}
                 required
                 placeholder="Enter email or mobile number"
               />

            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
