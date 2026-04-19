import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import heroArtwork from '../assets/media-studio-hero.png';
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
        <section className="auth-showcase">
          <div className="auth-showcase-copy">
            <p className="auth-kicker">Join Nova Canvas</p>
            <h1>Create your profile and start publishing better-looking work</h1>
            <p className="auth-showcase-text">
              Set up your creator account, unlock image and video workflows, and keep your identity ready for
              the community feed from day one.
            </p>
          </div>

          <div className="auth-showcase-art">
            <img
              src={heroArtwork}
              alt="Illustration of the AI media creation workflow"
              className="auth-hero-artwork"
            />
          </div>

          <div className="auth-highlights">
            <div className="auth-highlight-card">
              <strong>Identity</strong>
              <span>Creator profile, avatar, and public-facing presentation in one setup.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>Workflow</strong>
              <span>Generate, regenerate, download, and publish without leaving your studio.</span>
            </div>
          </div>
        </section>

        <div className="auth-card">
          <div className="auth-card-top">
            <p className="auth-card-kicker">Create account</p>
            <h2>Sign up</h2>
            <p className="auth-subtitle">Email ya mobile number se account banao aur code verify karke start karo.</p>
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
                SMS ke liye country code ke saath number likhiye, jaise +91 9876543210. Local development
                mein delivery service configured na ho to code yahin screen par dikh jayega.
              </p>
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
                placeholder="Invite code dalna ho to yahan likhiye"
                maxLength={16}
              />
              <p className="field-note">
                Agar kisi creator ne aapko invite kiya hai, to unka referral code yahan use kar sakte hain.
              </p>
            </div>

            <div className="form-group">
              <label>Password</label>
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
