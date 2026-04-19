import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/PublicGallery.css';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.readAsDataURL(file);
  });

const getImageDimensions = (imageUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error('Could not read the image dimensions'));
    image.src = imageUrl;
  });

const formatSourceLabel = (source) => (source === 'generated' ? 'Generated' : 'Uploaded');

const formatCount = (count = 0, singularLabel = 'item') => {
  const numericCount = Number(count || 0);
  if (numericCount === 1) {
    return `1 ${singularLabel}`;
  }

  return `${numericCount} ${singularLabel}s`;
};

const buildDefaultShareUrl = (postId) =>
  `${window.location.origin}/explore#post-${postId}`;

const renderAvatar = (post) => {
  if (post.userAvatarUrl) {
    return <img src={post.userAvatarUrl} alt={post.username} className="gallery-user-avatar" />;
  }

  return <div className="gallery-user-fallback">{post.username?.charAt(0)?.toUpperCase() || 'U'}</div>;
};

const PublicGallery = ({
  showComposer = false,
  title = 'Explore Images',
  subtitle = 'Search and discover public creations',
}) => {
  const { token, user, setUser } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [workingPostId, setWorkingPostId] = useState('');
  const [uploadPreviewAspectRatio, setUploadPreviewAspectRatio] = useState('4 / 3');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
  });
  const [commentDrafts, setCommentDrafts] = useState({});
  const uploadInputRef = useRef(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        search: searchQuery,
        limit: '18',
      });
      const data = await getJson(`/api/gallery/posts?${params.toString()}`, token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {});
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || 'Failed to load explore gallery');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const updatePostState = (postId, updates) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post._id === postId
          ? {
              ...post,
              ...updates,
            }
          : post
      )
    );
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleUploadInputChange = (e) => {
    const { name, value } = e.target;
    setUploadForm((current) => ({ ...current, [name]: value }));
  };

  const handleUploadFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await readFileAsDataUrl(file);
      const dimensions = await getImageDimensions(imageUrl);
      setUploadForm((current) => ({
        ...current,
        imageUrl,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      setUploadPreviewAspectRatio(
        dimensions.width && dimensions.height
          ? `${dimensions.width} / ${dimensions.height}`
          : '4 / 3'
      );
      setPublishMessage('');
    } catch (err) {
      setPublishMessage(err.message || 'Failed to load image preview');
    }
  };

  const handleOpenUploadPicker = (e) => {
    e?.preventDefault();

    const input = uploadInputRef.current;
    if (!input) return;

    // Allow picking the same file again after a previous selection.
    input.value = '';

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch (err) {
        // Fall back to click() when showPicker is unavailable or blocked.
      }
    }

    input.click();
  };

  const handlePublishUpload = async (e) => {
    e.preventDefault();
    if (!token) return;

    setUploading(true);
    setPublishMessage('');
    setActionMessage('');

    try {
      const data = await getJson('/api/gallery/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: uploadForm.title,
          description: uploadForm.description,
          imageUrl: uploadForm.imageUrl,
          source: 'upload',
        }),
      });

      if (data.currentUser) {
        setUser(data.currentUser);
      }

      setUploadForm({ title: '', description: '', imageUrl: '' });
      setUploadPreviewAspectRatio('4 / 3');
      setPublishMessage(data.message || 'Image published to Explore!');
      fetchPosts();
    } catch (err) {
      setPublishMessage(err.message || 'Failed to publish image');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFollow = async (targetUserId) => {
    if (!token) {
      setActionMessage('Log in to follow creators.');
      return;
    }

    setWorkingPostId(`follow-${targetUserId}`);
    setActionMessage('');

    try {
      const data = await getJson(`/api/user/${targetUserId}/follow`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.currentUser) {
        setUser(data.currentUser);
      }

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.userId === targetUserId
            ? {
                ...post,
                followingAuthor: data.following,
                authorFollowersCount: data.targetUser?.followersCount ?? post.authorFollowersCount,
              }
            : post
        )
      );
      setActionMessage(data.message || 'Follow status updated');
    } catch (err) {
      setActionMessage(err.message || 'Could not update follow status');
    } finally {
      setWorkingPostId('');
    }
  };

  const handleToggleLike = async (postId) => {
    if (!token) {
      setActionMessage('Log in to like posts.');
      return;
    }

    setWorkingPostId(`like-${postId}`);
    setActionMessage('');

    try {
      const data = await getJson(`/api/gallery/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.post) {
        updatePostState(postId, data.post);
      }
      if (data.currentUser) {
        setUser(data.currentUser);
      }
      setActionMessage(data.message || 'Like status updated');
    } catch (err) {
      setActionMessage(err.message || 'Could not update like status');
    } finally {
      setWorkingPostId('');
    }
  };

  const shareLink = async (shareUrl, postTitle) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: postTitle,
          text: 'Check out this image on Explore',
          url: shareUrl,
        });
        return 'Share sheet opened.';
      } catch (error) {
        if (error?.name === 'AbortError') {
          return 'Share cancelled.';
        }
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    return 'Share link copied to clipboard.';
  };

  const handleSharePost = async (postId, postTitle) => {
    setWorkingPostId(`share-${postId}`);
    setActionMessage('');

    try {
      const data = await getJson(`/api/gallery/posts/${postId}/share`, {
        method: 'POST',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      if (data.post) {
        updatePostState(postId, data.post);
      }

      const message = await shareLink(data.shareUrl || buildDefaultShareUrl(postId), postTitle);
      setActionMessage(message);
    } catch (err) {
      setActionMessage(err.message || 'Could not share this post');
    } finally {
      setWorkingPostId('');
    }
  };

  const handleCommentInputChange = (postId, value) => {
    setCommentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [postId]: value,
    }));
  };

  const handleSubmitComment = async (postId) => {
    if (!token) {
      setActionMessage('Log in to comment on posts.');
      return;
    }

    const content = String(commentDrafts[postId] || '').trim();
    if (!content) {
      setActionMessage('Comment likhiye phir post kijiye.');
      return;
    }

    setWorkingPostId(`comment-${postId}`);
    setActionMessage('');

    try {
      const data = await getJson(`/api/gallery/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (data.post) {
        updatePostState(postId, data.post);
      }

      if (data.currentUser) {
        setUser(data.currentUser);
      }

      setCommentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [postId]: '',
      }));
      setActionMessage(data.message || 'Comment added');
    } catch (err) {
      setActionMessage(err.message || 'Could not add comment');
    } finally {
      setWorkingPostId('');
    }
  };

  const canFollowAuthor = (post) => Boolean(token && user?.id && user.id !== post.userId);

  return (
    <div className="public-gallery">
      <div className="gallery-hero">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {!showComposer && token && (
          <Link to="/dashboard" className="gallery-hero-link">
            Open Creator Studio
          </Link>
        )}
      </div>

      {showComposer && (
        <section className="gallery-composer">
          <div className="composer-copy">
            <h3>Upload Your Own Image</h3>
            <p>Share your creation publicly so anyone can search and watch it in Explore.</p>
          </div>

          {!token ? (
            <div className="gallery-login-box">
              <p>Log in to upload images and build your public gallery.</p>
              <Link to="/login" className="gallery-hero-link">
                Log In
              </Link>
            </div>
          ) : (
            <form className="gallery-upload-form" onSubmit={handlePublishUpload}>
              <div className="gallery-upload-grid">
                <div className="gallery-upload-fields">
                  <label>
                    Title
                    <input
                      type="text"
                      name="title"
                      value={uploadForm.title}
                      onChange={handleUploadInputChange}
                      placeholder="Give your image a catchy title"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      name="description"
                      value={uploadForm.description}
                      onChange={handleUploadInputChange}
                      placeholder="Describe the image so people can find it"
                      maxLength={2000}
                      rows={4}
                    />
                  </label>
                </div>

                <div
                  className={`gallery-upload-preview ${uploadForm.imageUrl ? 'has-image' : ''}`}
                  style={{ aspectRatio: uploadPreviewAspectRatio }}
                  onClick={handleOpenUploadPicker}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenUploadPicker(e);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Click to choose an image"
                  title="Click to choose an image"
                >
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFileChange}
                    className="gallery-hidden-file-input"
                    tabIndex={-1}
                  />
                  {uploadForm.imageUrl ? (
                    <img src={uploadForm.imageUrl} alt="Upload preview" />
                  ) : (
                    <div className="gallery-preview-empty">
                      <strong>{user?.username || 'Creator'}</strong>
                      <span>Click here to choose an image</span>
                    </div>
                  )}
                </div>
              </div>

              {publishMessage && <div className="success-message">{publishMessage}</div>}

              <button
                type="submit"
                className="gallery-publish-btn"
                disabled={uploading || !uploadForm.title.trim() || !uploadForm.imageUrl}
              >
                {uploading ? 'Publishing...' : 'Publish to Explore'}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="gallery-search-panel">
        <form onSubmit={handleSearchSubmit} className="gallery-search-form">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search titles, descriptions, prompts, or creator names"
          />
          <button type="submit">Search</button>
        </form>
      </section>

      {actionMessage && <div className="success-message">{actionMessage}</div>}
      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="gallery-loading">Loading public gallery...</div>
      ) : posts.length === 0 ? (
        <div className="gallery-empty">
          <h3>No images found</h3>
          <p>Try another search or publish the first image to Explore.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {posts.map((post) => {
            const followBusy = workingPostId === `follow-${post.userId}`;
            const likeBusy = workingPostId === `like-${post._id}`;
            const shareBusy = workingPostId === `share-${post._id}`;
            const commentBusy = workingPostId === `comment-${post._id}`;

            return (
              <article key={post._id} className="gallery-card" id={`post-${post._id}`}>
                <div className="gallery-card-media">
                  <img src={post.imageUrl} alt={post.title} />
                </div>
                <div className="gallery-card-body">
                  <div className="gallery-card-header">
                    <div className="gallery-card-user">
                      <Link
                        to={`/users/${post.userId}`}
                        className="gallery-user-link"
                        aria-label={`Open ${post.username}'s profile`}
                      >
                        {renderAvatar(post)}
                        <div>
                          <strong>{post.username}</strong>
                          <span>{formatSourceLabel(post.source)}</span>
                          <small>{formatCount(post.authorFollowersCount, 'follower')}</small>
                        </div>
                      </Link>
                    </div>
                    {canFollowAuthor(post) && (
                      <button
                        type="button"
                        className={`gallery-follow-btn ${post.followingAuthor ? 'is-following' : ''}`}
                        onClick={() => handleToggleFollow(post.userId)}
                        disabled={followBusy}
                      >
                        {followBusy ? 'Saving...' : post.followingAuthor ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>

                  <h3>{post.title}</h3>
                  <p>{post.description || post.prompt || 'No description added yet.'}</p>

                  <div className="gallery-card-actions">
                    <button
                      type="button"
                      className={`gallery-action-btn ${post.likedByCurrentUser ? 'is-active' : ''}`}
                      onClick={() => handleToggleLike(post._id)}
                      disabled={likeBusy}
                    >
                      {likeBusy ? 'Saving...' : 'Like'}
                      <span>{formatCount(post.likesCount, 'like')}</span>
                    </button>
                    <button
                      type="button"
                      className="gallery-action-btn"
                      onClick={() => handleSharePost(post._id, post.title)}
                      disabled={shareBusy}
                    >
                      {shareBusy ? 'Sharing...' : 'Share'}
                      <span>{formatCount(post.shareCount, 'share')}</span>
                    </button>
                  </div>

                  <div className="gallery-comments">
                    <div className="gallery-comments-head">
                      <strong>Comments</strong>
                      <span>{formatCount(post.commentsCount || 0, 'comment')}</span>
                    </div>

                    {post.commentsCount ? (
                      <div className="gallery-comment-list">
                        {(post.comments || []).map((comment) => (
                          <div key={comment._id || `${post._id}-${comment.createdAt}`} className="gallery-comment-item">
                            <div className="gallery-comment-meta">
                              <strong>{comment.username}</strong>
                              <span>{new Date(comment.createdAt).toLocaleString('en-IN')}</span>
                            </div>
                            <p>{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="gallery-comments-empty">No comments yet.</p>
                    )}

                    {token ? (
                      <div className="gallery-comment-form">
                        <input
                          type="text"
                          value={commentDrafts[post._id] || ''}
                          onChange={(event) => handleCommentInputChange(post._id, event.target.value)}
                          placeholder="Write a comment"
                          maxLength={500}
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitComment(post._id)}
                          disabled={commentBusy}
                        >
                          {commentBusy ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    ) : (
                      <p className="gallery-comments-login">Log in to comment on this post.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PublicGallery;
