import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/UserProfile.css';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not load the selected image'));
    reader.readAsDataURL(file);
  });

const UserProfile = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { token, setUser, logout } = useAuth();
  const inviteLink = user?.referralCode
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(user.referralCode)}`
    : '';

  useEffect(() => {
    setUsername(user?.username || '');
    setAvatarUrl(user?.avatarUrl || '');
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setMessage(err.message || 'Could not update profile image');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data = await getJson('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, avatarUrl }),
      });

      setUser(data.user);
      setMessage('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage('Invite link copied successfully!');
    } catch (err) {
      setMessage('Invite link copy nahi ho paya');
    }
  };

  return (
    <div className="user-profile">
      <h2>Your Profile</h2>

      {message && <div className="success-message">{message}</div>}

      <div className="profile-card">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={user?.username || 'Profile'} className="avatar-image" />
          ) : (
            <div className="avatar-placeholder">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="profile-info">
          <div className="profile-stats" aria-label="Profile stats">
            <div className="profile-stat-card">
              <strong>{user?.tokenBalance ?? 0}</strong>
              <span>Tokens</span>
            </div>
            <div className="profile-stat-card">
              <strong>{user?.followersCount ?? 0}</strong>
              <span>Followers</span>
            </div>
            <div className="profile-stat-card">
              <strong>{user?.followingCount ?? 0}</strong>
              <span>Following</span>
            </div>
          </div>

          {!isEditing ? (
            <>
              <div className="info-row">
                <label>Username</label>
                <p>{user?.username}</p>
              </div>
              <div className="info-row">
                <label>Email</label>
                <p>{user?.email || 'Not added'}</p>
              </div>
              <div className="info-row">
                <label>Mobile</label>
                <p>{user?.phone || 'Not added'}</p>
              </div>
              <div className="info-row">
                <label>Referral Code</label>
                <p>{user?.referralCode || 'Generating...'}</p>
              </div>
              <div className="invite-panel">
                <div>
                  <strong>Invite & Earn</strong>
                  <p>Har successful invite par 70 tokens milenge.</p>
                </div>
                <button type="button" className="edit-btn" onClick={handleCopyInvite} disabled={!inviteLink}>
                  Copy Invite Link
                </button>
              </div>
              <button className="edit-btn" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            </>
          ) : (
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Profile Picture</label>
                <div className="avatar-editor">
                  <label className="avatar-upload-btn">
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </label>
                  <button
                    type="button"
                    className="avatar-remove-btn"
                    onClick={() => setAvatarUrl('')}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email (read-only)</label>
                <input type="email" value={user?.email || ''} disabled />
              </div>
              <div className="form-group">
                <label>Mobile (read-only)</label>
                <input type="text" value={user?.phone || ''} disabled />
              </div>
              <div className="button-group">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setIsEditing(false);
                    setUsername(user?.username || '');
                    setAvatarUrl(user?.avatarUrl || '');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="profile-actions">
          <button className="logout-btn" onClick={logout} title="Logout">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
