const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizeId, normalizeIdList, serializeUser } = require('../utils/userSerializer');
const { getContactFromIdentifier, normalizeEmail, normalizePhone } = require('../utils/validators');

const STORE_FILE_PATH = path.join(__dirname, 'memory-store.json');

const state = {
  users: [],
  images: [],
  galleryPosts: [],
};

const generateId = () => crypto.randomUUID();

const loadStore = () => {
  try {
    if (!fs.existsSync(STORE_FILE_PATH)) {
      return;
    }

    const rawStore = fs.readFileSync(STORE_FILE_PATH, 'utf8');
    if (!rawStore.trim()) {
      return;
    }

    const parsedStore = JSON.parse(rawStore);
    state.users = Array.isArray(parsedStore.users)
      ? parsedStore.users.map((user) => ({
          ...user,
          email: user.email ? normalizeEmail(user.email) : undefined,
          phone: user.phone ? normalizePhone(user.phone) : undefined,
          followers: normalizeIdList(user.followers || user.followerUserIds),
          following: normalizeIdList(user.following || user.followingUserIds),
        }))
      : [];
    state.images = Array.isArray(parsedStore.images) ? parsedStore.images : [];
    state.galleryPosts = Array.isArray(parsedStore.galleryPosts)
      ? parsedStore.galleryPosts.map((post) => ({
          ...post,
          likedBy: normalizeIdList(post.likedBy || post.likedByUserIds),
          shareCount: Number(post.shareCount || 0),
          authorFollowersCount: Number(post.authorFollowersCount || 0),
        }))
      : [];
  } catch (error) {
    console.error('Could not load persistent fallback store:', error.message);
  }
};

const saveStore = () => {
  try {
    fs.writeFileSync(
      STORE_FILE_PATH,
      JSON.stringify(
        {
          users: state.users,
          images: state.images,
          galleryPosts: state.galleryPosts,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (error) {
    console.error('Could not save persistent fallback store:', error.message);
  }
};

loadStore();

// Create demo user if no users exist
const createDemoUser = async () => {
  if (state.users.length === 0) {
    try {
      await createUser({
        username: 'demo',
        email: 'demo@example.com',
        password: 'demo123'
      });
      console.log('Demo user created: demo@example.com / demo123');
    } catch (error) {
      console.error('Failed to create demo user:', error.message);
    }
  }
};

createDemoUser();

const sanitizeUser = (user) => {
  if (!user) return null;
  return serializeUser(user);
};

const syncGalleryPostsForUser = (userId, updates = {}) => {
  state.galleryPosts = state.galleryPosts.map((post) =>
    post.userId === userId
      ? {
          ...post,
          ...updates,
        }
      : post
  );
};

const createUser = async ({ username, email, phone, password }) => {
  const normalizedEmail = email ? normalizeEmail(email) : '';
  const normalizedPhone = phone ? normalizePhone(phone) : '';
  const normalizedUsername = username.trim();

  const duplicateUser = state.users.find(
    (user) =>
      user.username === normalizedUsername ||
      (normalizedEmail && user.email === normalizedEmail) ||
      (normalizedPhone && user.phone === normalizedPhone)
  );

  if (duplicateUser) {
    const error = new Error('Email or username already exists');
    error.code = 11000;
    throw error;
  }

  const user = {
    _id: generateId(),
    username: normalizedUsername,
    email: normalizedEmail || undefined,
    phone: normalizedPhone || undefined,
    password: await bcrypt.hash(password, 10),
    avatarUrl: '',
    followers: [],
    following: [],
    createdAt: new Date().toISOString(),
  };

  state.users.push(user);
  saveStore();
  return sanitizeUser(user);
};

const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const user = state.users.find((user) => user.email === normalizedEmail) || null;
  return user ? sanitizeUser(user) : null;
};

const findUserByIdentifier = async (identifier) => {
  const contact = getContactFromIdentifier(identifier);
  if (!contact) return null;

  const user = state.users.find((entry) =>
    contact.type === 'email'
      ? entry.email === contact.value
      : entry.phone === contact.value
  ) || null;

  return user ? sanitizeUser(user) : null;
};

const findUserById = async (userId) => {
  const user = state.users.find((entry) => entry._id === userId);
  return sanitizeUser(user);
};

const getUserRecordById = async (userId) =>
  state.users.find((entry) => entry._id === userId) || null;

const findUserRecordByIdentifier = async (identifier) => {
  const contact = getContactFromIdentifier(identifier);
  if (!contact) return null;

  return state.users.find((entry) =>
    contact.type === 'email'
      ? entry.email === contact.value
      : entry.phone === contact.value
  ) || null;
};

const comparePassword = async (user, passwordAttempt) => {
  if (!user) return false;
  return bcrypt.compare(passwordAttempt, user.password);
};

const updateUserPassword = async (userId, nextPassword) => {
  const user = state.users.find((entry) => entry._id === userId);
  if (!user) return null;

  user.password = await bcrypt.hash(nextPassword, 10);
  saveStore();
  return sanitizeUser(user);
};

const updateUser = async (userId, updates) => {
  const user = state.users.find((entry) => entry._id === userId);
  if (!user) return null;

  const nextUsername = updates.username?.trim();
  if (nextUsername) {
    const duplicateUser = state.users.find(
      (entry) => entry._id !== userId && entry.username === nextUsername
    );

    if (duplicateUser) {
      const error = new Error('Username already exists');
      error.code = 11000;
      throw error;
    }

    user.username = nextUsername;
  }

  if (typeof updates.avatarUrl === 'string') {
    user.avatarUrl = updates.avatarUrl;
  }

  if (nextUsername || typeof updates.avatarUrl === 'string') {
    syncGalleryPostsForUser(userId, {
      username: user.username,
      userAvatarUrl: user.avatarUrl || '',
    });
    saveStore();
  }

  return sanitizeUser(user);
};

const createImage = async ({ userId, prompt, imageUrl, ratio, quality }) => {
  const image = {
    _id: generateId(),
    userId,
    prompt,
    imageUrl,
    ratio,
    quality,
    generatedAt: new Date().toISOString(),
  };

  state.images.push(image);
  saveStore();
  return image;
};

const getImagesByUserId = async (userId, page, limit) => {
  const numericPage = Number(page) || 1;
  const numericLimit = Number(limit) || 10;
  const userImages = state.images
    .filter((image) => image.userId === userId)
    .sort((left, right) => new Date(right.generatedAt) - new Date(left.generatedAt));
  const start = (numericPage - 1) * numericLimit;

  return {
    images: userImages.slice(start, start + numericLimit),
    total: userImages.length,
    pages: Math.max(1, Math.ceil(userImages.length / numericLimit)),
    currentPage: numericPage,
  };
};

const findImageById = async (imageId) => state.images.find((image) => image._id === imageId) || null;

const deleteImageById = async (imageId) => {
  const imageIndex = state.images.findIndex((image) => image._id === imageId);
  if (imageIndex === -1) return null;

  const [deletedImage] = state.images.splice(imageIndex, 1);
  saveStore();
  return deletedImage;
};

const createGalleryPost = async ({
  userId,
  username,
  userAvatarUrl,
  authorFollowersCount = 0,
  title,
  description,
  prompt,
  imageUrl,
  source,
}) => {
  const galleryPost = {
    _id: generateId(),
    userId,
    username,
    userAvatarUrl: userAvatarUrl || '',
    title: title.trim(),
    description: (description || '').trim(),
    prompt: (prompt || '').trim(),
    imageUrl,
    source: source || 'upload',
    likedBy: [],
    shareCount: 0,
    authorFollowersCount: Number(authorFollowersCount || 0),
    createdAt: new Date().toISOString(),
  };

  state.galleryPosts.push(galleryPost);
  saveStore();
  return galleryPost;
};

const serializeGalleryPost = (post, viewerUserId = '') => {
  const normalizedViewerUserId = normalizeId(viewerUserId);
  const viewer = normalizedViewerUserId
    ? state.users.find((user) => user._id === normalizedViewerUserId)
    : null;
  const viewerFollowing = viewer?.following || [];
  const likedBy = normalizeIdList(post.likedBy);
  const normalizedPostUserId = normalizeId(post.userId);

  return {
    ...post,
    _id: normalizeId(post._id),
    userId: normalizedPostUserId,
    likedByCurrentUser: normalizedViewerUserId ? likedBy.includes(normalizedViewerUserId) : false,
    followingAuthor: normalizedViewerUserId ? viewerFollowing.includes(normalizedPostUserId) : false,
    likesCount: likedBy.length,
    shareCount: Number(post.shareCount || 0),
    authorFollowersCount: Number(post.authorFollowersCount || 0),
  };
};

const getPublicGalleryPosts = async ({ search = '', page = 1, limit = 12, viewerUserId = '' }) => {
  const normalizedSearch = search.trim().toLowerCase();
  const numericPage = Number(page) || 1;
  const numericLimit = Number(limit) || 12;

  const filteredPosts = state.galleryPosts
    .filter((post) => {
      if (!normalizedSearch) return true;
      const haystack = [
        post.title,
        post.description,
        post.prompt,
        post.username,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  const start = (numericPage - 1) * numericLimit;

  return {
    posts: filteredPosts
      .slice(start, start + numericLimit)
      .map((post) => serializeGalleryPost(post, viewerUserId)),
    total: filteredPosts.length,
    pages: Math.max(1, Math.ceil(filteredPosts.length / numericLimit)),
    currentPage: numericPage,
  };
};

const getPublicUserProfile = async ({ targetUserId, viewerUserId = '' }) => {
  const targetUser = state.users.find((entry) => entry._id === targetUserId);
  if (!targetUser) return null;

  const viewer = viewerUserId
    ? state.users.find((entry) => entry._id === viewerUserId) || null
    : null;
  const viewerFollowing = normalizeIdList(viewer?.following);
  const publicUser = sanitizeUser(targetUser);
  const posts = state.galleryPosts
    .filter((post) => normalizeId(post.userId) === targetUserId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((post) => serializeGalleryPost(post, viewerUserId));

  return {
    user: publicUser
      ? {
          _id: publicUser.id,
          id: publicUser.id,
          username: publicUser.username,
          avatarUrl: publicUser.avatarUrl,
          createdAt: publicUser.createdAt,
          followersCount: publicUser.followersCount,
          followingCount: publicUser.followingCount,
        }
      : null,
    posts,
    totalPublicPosts: posts.length,
    isCurrentUser: viewerUserId === targetUserId,
    isFollowing: viewerFollowing.includes(targetUserId),
    canFollow: Boolean(viewerUserId && viewerUserId !== targetUserId),
  };
};

const toggleFollowUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    throw new Error('You cannot follow yourself');
  }

  const currentUser = state.users.find((entry) => entry._id === currentUserId);
  const targetUser = state.users.find((entry) => entry._id === targetUserId);

  if (!currentUser || !targetUser) {
    throw new Error('User not found');
  }

  const isFollowing = currentUser.following.includes(targetUserId);

  currentUser.following = isFollowing
    ? currentUser.following.filter((id) => id !== targetUserId)
    : [...currentUser.following, targetUserId];

  targetUser.followers = isFollowing
    ? targetUser.followers.filter((id) => id !== currentUserId)
    : [...targetUser.followers, currentUserId];

  syncGalleryPostsForUser(targetUserId, {
    authorFollowersCount: targetUser.followers.length,
  });
  saveStore();

  return {
    following: !isFollowing,
    currentUser: sanitizeUser(currentUser),
    targetUser: sanitizeUser(targetUser),
  };
};

const findGalleryPostById = async (postId) =>
  state.galleryPosts.find((post) => post._id === postId) || null;

const toggleGalleryPostLike = async (postId, userId) => {
  const post = state.galleryPosts.find((entry) => entry._id === postId);
  if (!post) return null;

  const normalizedUserId = normalizeId(userId);
  const likedBy = normalizeIdList(post.likedBy);
  const isLiked = likedBy.includes(normalizedUserId);

  post.likedBy = isLiked
    ? likedBy.filter((id) => id !== normalizedUserId)
    : [...likedBy, normalizedUserId];

  saveStore();
  return serializeGalleryPost(post, normalizedUserId);
};

const incrementGalleryPostShare = async (postId, viewerUserId = '') => {
  const post = state.galleryPosts.find((entry) => entry._id === postId);
  if (!post) return null;

  post.shareCount = Number(post.shareCount || 0) + 1;
  saveStore();
  return serializeGalleryPost(post, viewerUserId);
};

module.exports = {
  comparePassword,
  createGalleryPost,
  createImage,
  createUser,
  deleteImageById,
  findImageById,
  findGalleryPostById,
  findUserByIdentifier,
  findUserByEmail,
  findUserById,
  findUserRecordByIdentifier,
  getImagesByUserId,
  getPublicGalleryPosts,
  getPublicUserProfile,
  getUserRecordById,
  incrementGalleryPostShare,
  sanitizeUser,
  toggleFollowUser,
  toggleGalleryPostLike,
  updateUser,
  updateUserPassword,
};
