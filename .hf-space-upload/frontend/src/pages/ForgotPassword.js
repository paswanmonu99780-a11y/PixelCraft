import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/Auth.css';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [passwordStrength, setPasswordStrength] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { sendPasswordResetCode, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      try {
        const data = await getJson('/api/auth/check-password-strength', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: value }),
        });
        setPasswordStrength(data.strength);
      } catch (err) {
        console.error('Error checking password strength:', err);
      }
    }
  };

  const handleSendCode = async () => {
    setError('');
    setSuccessMessage('');

    if (!formData.identifier.trim()) {
      setError('Email ya mobile number enter kijiye');
      return;
    }

    setSendingCode(true);

    try {
      const data = await sendPasswordResetCode(formData.identifier);
      setCodeSent(true);
      setSuccessMessage(
        data.debugCode
          ? `${data.message} Dev code: ${data.debugCode}`
          : data.message
      );
    } catch (err) {
      setError(err.message || 'Reset code bhejne mein problem hui');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await resetPassword(formData);
      setSuccessMessage('Password reset ho gaya. Ab aap login kar sakte hain.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'Weak':
        return '#ef4444';
      case 'Fair':
        return '#f97316';
      case 'Good':
        return '#eab308';
      case 'Strong':
        return '#22c55e';
      default:
        return '#d1d5db';
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">Email ya mobile number par code paakar naya password set kijiye</p>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email or Mobile Number</label>
            <div className="auth-action-row">
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                required
                placeholder="your@email.com or +91 9876543210"
              />
              <button
                type="button"
                className="secondary-auth-button"
                onClick={handleSendCode}
                disabled={sendingCode}
              >
                {sendingCode ? 'Sending...' : codeSent ? 'Resend Code' : 'Send Code'}
              </button>
            </div>
            <p className="field-note">
              SMS ke liye country code ke saath number likhiye, jaise +91 9876543210.
              Agar delivery service configured nahi hai to dev code isi screen par show hoga.
            </p>
          </div>

          {codeSent && (
            <>
              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="At least 8 characters"
                />
                {formData.password && (
                  <div className="password-strength">
                    <div
                      className="strength-bar"
                      style={{ backgroundColor: getStrengthColor(), width: '100%' }}
                    />
                    <p style={{ color: getStrengthColor() }}>{passwordStrength}</p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Confirm your new password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading || !codeSent}
          >
            {loading ? 'Resetting Password...' : 'Verify Code & Reset Password'}
          </button>
        </form>

        <p className="auth-link">
          Remembered your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
