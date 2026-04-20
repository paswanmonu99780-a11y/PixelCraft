import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/Auth.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    identifier: '',
    password: '',
    confirmPassword: '',
    code: '',
    referralCode: '',
  });
  const [passwordStrength, setPasswordStrength] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { sendSignupCode, signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    const referralCode = searchParams.get('ref') || '';
    if (referralCode) {
      setFormData((prev) => ({
        ...prev,
        referralCode,
      }));
    }
  }, [searchParams]);

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
      const data = await sendSignupCode(formData.identifier);
      setCodeSent(true);
      setSuccessMessage(
        data.debugCode
          ? `${data.message} Dev code: ${data.debugCode}`
          : data.message
      );
    } catch (err) {
      setError(err.message || 'Verification code bhejne mein problem hui');
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
      await signup(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed');
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
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-top">
            <p className="auth-card-kicker">Create account</p>
            <h2>Sign up</h2>
          </div>

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="Choose your username"
              />
            </div>

            <div className="form-group">
              <label>Email or Mobile Number</label>
              <div className="auth-action-row">
                 <input
                   type="text"
                   name="identifier"
                   value={formData.identifier}
                   onChange={handleInputChange}
                   required
                   placeholder="Enter email or mobile number"
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
             </div>

            {codeSent && (
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
            )}

            <div className="form-group">
              <label>Referral Code (Optional)</label>
               <input
                 type="text"
                 name="referralCode"
                 value={formData.referralCode}
                 onChange={handleInputChange}
                 placeholder="Referral code (optional)"
                 maxLength={16}
               />
             </div>

            <div className="form-group">
              <label>Password</label>
               <input
                 type="password"
                 name="password"
                 value={formData.password}
                 onChange={handleInputChange}
                 required
                 placeholder="Create a strong password"
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
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading || !codeSent}
            >
              {loading ? 'Creating Account...' : 'Verify Code & Sign Up'}
            </button>
          </form>

          <p className="auth-link">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
