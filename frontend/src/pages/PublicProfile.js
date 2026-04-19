import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/Explore.css';
import '../styles/PublicGallery.css';
import '../styles/PublicProfile.css';

const formatDate = (value) => {
  if (!value) {
    return 'Recently joined';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Recently joined';
  }

  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatCount = (count = 0, singularLabel = 'item') => {
  const numericCount = Number(count || 0);
  return `${numericCount} ${singularLabel}${numericCount === 1 ? '' : 's'}`;
};

const formatSourceLabel = (source) => (source === 'generated' ? 'Generated' : 'Uploaded');

const PublicProfile = () => {
  const { userId } = useParams();
  const { token, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      setMessage('');

      try {
        const data = await getJson(`/api/user/${userId}/profile`, token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {});

        if (!isActive) {
          return;
        }

        setProfile({
          ...data.user,
          totalPublicPosts: Number(data.totalPublicPosts || 0),
          isCurrentUser: Boolean(data.isCurrentUser),
          isFollowing: Boolean(data.isFollowing),
          canFollow: Boolean(data.canFollow),
        });
        setPosts(data.posts || []);
      } catch (err) {
        if (isActive) {
          setError(err.message || 'Could not load this profile');
          setProfile(null);
          setPosts([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [token, userId]);

  const handleToggleFollow = async () => {
    if (!token) {
      setMessage('Log in to follow creators.');
      return;
    }

    setFollowBusy(true);
    setMessage('');

    try {
      const data = await getJson(`/api/user/${userId}/follow`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.currentUser) {
        setUser(data.currentUser);
      }

      setProfile((currentProfile) => {
        if (!currentProfile) {
          return currentProfile;
        }

        return {
          ...currentProfile,
          isFollowing: Boolean(data.following),
          followersCount: data.targetUser?.followersCount ?? currentProfile.followersCount,
        };
      });

      setPosts((currentPosts) =>
        currentPosts.map((post) => ({
          ...post,
          authorFollowersCount: data.targetUser?.followersCount ?? post.authorFollowersCount,
        }))
      );
      setMessage(data.message || 'Follow status updated');
    } catch (err) {
      setMessage(err.message || 'Could not update follow status');
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div className="explore-page">
      <header className="explore-header">
        <Link to="/" className="explore-brand">
          AI Image Generator
        </Link>
        <div className="explore-actions">
          <Link to="/explore" className="explore-link">
            Explore
          </Link>
          {token ? (
            <Link to="/dashboard" className="explore-cta">
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

      <main className="explore-main public-profile-main">
        {loading ? (
          <section className="public-profile-shell">
            <div className="public-profile-feedback">Loading profile...</div>
          </section>
        ) : error ? (
          <section className="public-profile-shell">
            <div className="public-profile-feedback public-profile-feedback-error">{error}</div>
          </section>
        ) : profile ? (
          <>
            <section className="public-profile-shell public-profile-hero">
              <div className="public-profile-summary">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username || 'Creator'}
                    className="public-profile-avatar"
                  />
                ) : (
                  <div className="public-profile-avatar public-profile-avatar-fallback">
                    {(profile.username || 'C').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="public-profile-copy">
                  <p className="public-profile-kicker">Creator profile</p>
                  <h1>{profile.username}</h1>
                  <p className="public-profile-meta">Joined {formatDate(profile.createdAt)}</p>
                </div>
              </div>

              <div className="public-profile-actions">
                {profile.canFollow && (
                  <button
                    type="button"
                    className={`gallery-follow-btn ${profile.isFollowing ? 'is-following' : ''}`}
                    onClick={handleToggleFollow}
                    disabled={followBusy}
                  >
                    {followBusy ? 'Saving...' : profile.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                {profile.isCurrentUser && token && (
                  <Link to="/dashboard" className="public-profile-secondary-link">
                    Open Your Dashboard
                  </Link>
                )}
              </div>
            </section>

            {message && <div className="public-profile-feedback">{message}</div>}

            <section className="public-profile-stats">
              <article className="public-profile-stat-card">
                <strong>{profile.followersCount ?? 0}</strong>
                <span>Followers</span>
              </article>
              <article className="public-profile-stat-card">
                <strong>{profile.followingCount ?? 0}</strong>
                <span>Following</span>
              </article>
              <article className="public-profile-stat-card">
                <strong>{profile.totalPublicPosts ?? posts.length}</strong>
                <span>Public Images</span>
              </article>
            </section>

            <section className="public-profile-gallery">
              <div className="public-profile-gallery-head">
                <div>
                  <h2>Public Images</h2>
                  <p>Uploads and generated work shared by this creator.</p>
                </div>
                <Link to="/explore" className="public-profile-secondary-link">
                  Back to Explore
                </Link>
              </div>

              {posts.length === 0 ? (
                <div className="public-profile-feedback">This creator has not published any public images yet.</div>
              ) : (
                <div className="gallery-grid">
                  {posts.map((post) => (
                    <article key={post._id} className="gallery-card">
                      <div className="gallery-card-media">
                        <img src={post.imageUrl} alt={post.title} />
                      </div>
                      <div className="gallery-card-body">
                        <div className="public-profile-post-meta">
                          <span>{formatSourceLabel(post.source)}</span>
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                        <h3>{post.title}</h3>
                        <p>{post.description || post.prompt || 'No description added yet.'}</p>
                        <div className="public-profile-post-stats">
                          <span>{formatCount(post.likesCount, 'like')}</span>
                          <span>{formatCount(post.shareCount, 'share')}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default PublicProfile;
