const DEMO_STORE_KEY = 'pixelcraft-demo-store-v1';
const DEMO_TOKEN_PREFIX = 'demo-token:';
const SIGNUP_CODE_PURPOSE = 'signup';
const RESET_CODE_PURPOSE = 'password-reset';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_PROMPT_LENGTH = 2000;

const PHONE_REGEX = /^\d{10,15}$/;

const DEFAULT_STORE = {
  users: [],
  images: [],
  galleryPosts: [],
  otpCodes: [],
};

const DEFAULT_VIDEO_STATUS = {
  canGenerate: false,
  level: 'warning',
  selectedBackend: 'disabled',
  provider: '',
  message: 'Free GitHub Pages demo me video generation disabled hai. Full video features ke liye backend hosting chahiye.',
};

const ASPECT_RATIO_PRESETS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
};

const isBrowser = typeof window !== 'undefined';

const clone = (value) => JSON.parse(JSON.stringify(value));

const readStore = () => {
  if (!isBrowser) {
    return clone(DEFAULT_STORE);
  }

  try {
    const rawValue = window.localStorage.getItem(DEMO_STORE_KEY);
    if (!rawValue) {
      return clone(DEFAULT_STORE);
    }

    const parsedValue = JSON.parse(rawValue);
    return {
      users: Array.isArray(parsedValue.users) ? parsedValue.users : [],
      images: Array.isArray(parsedValue.images) ? parsedValue.images : [],
      galleryPosts: Array.isArray(parsedValue.galleryPosts) ? parsedValue.galleryPosts : [],
      otpCodes: Array.isArray(parsedValue.otpCodes) ? parsedValue.otpCodes : [],
    };
  } catch (error) {
    return clone(DEFAULT_STORE);
  }
};

const writeStore = (store) => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
};

const generateId = (prefix = 'demo') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const normalizePhone = (value = '') => String(value || '').replace(/[^\d]/g, '');
const isEmail = (value = '') => /.+@.+\..+/.test(normalizeEmail(value));
const isPhone = (value = '') => PHONE_REGEX.test(normalizePhone(value));

const resolveContact = (identifier = '') => {
  const trimmedValue = String(identifier || '').trim();
  if (!trimmedValue) {
    return null;
  }

  if (isEmail(trimmedValue)) {
    const value = normalizeEmail(trimmedValue);
    return {
      type: 'email',
      value,
      label: value,
    };
  }

  if (isPhone(trimmedValue)) {
    const value = normalizePhone(trimmedValue);
    return {
      type: 'phone',
      value,
      label: value,
    };
  }

  return null;
};

const validatePassword = (password = '') =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);

const getPasswordStrength = (password = '') => {
  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/\d/.test(password)) strength += 1;
  if (/[@$!%*?&]/.test(password)) strength += 1;

  if (strength <= 2) return 'Weak';
  if (strength <= 4) return 'Fair';
  if (strength <= 5) return 'Good';
  return 'Strong';
};

const createToken = (userId = '') => `${DEMO_TOKEN_PREFIX}${userId}`;

const parseToken = (options = {}) => {
  const authHeader =
    options?.headers?.Authorization ||
    options?.headers?.authorization ||
    '';

  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.startsWith(DEMO_TOKEN_PREFIX) ? token.slice(DEMO_TOKEN_PREFIX.length) : '';
};

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const ensureAuthenticatedUser = (store, options) => {
  const userId = parseToken(options);
  if (!userId) {
    throw createError('No token provided', 401);
  }

  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw createError('Invalid token', 401);
  }

  return user;
};

const getBody = (options = {}) => {
  if (!options?.body) {
    return {};
  }

  if (typeof options.body === 'string') {
    try {
      return JSON.parse(options.body);
    } catch (error) {
      return {};
    }
  }

  return options.body;
};

const trimText = (value = '') => String(value || '').trim();

const serializeUser = (user) => ({
  _id: user.id,
  id: user.id,
  username: user.username,
  email: user.email || '',
  phone: user.phone || '',
  contactMethod: user.email ? 'email' : user.phone ? 'phone' : '',
  contactValue: user.email || user.phone || '',
  avatarUrl: user.avatarUrl || '',
  createdAt: user.createdAt,
  followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
  followingCount: Array.isArray(user.following) ? user.following.length : 0,
  followerUserIds: Array.isArray(user.followers) ? [...user.followers] : [],
  followingUserIds: Array.isArray(user.following) ? [...user.following] : [],
});

const createDemoCode = () => String(Math.floor(100000 + Math.random() * 900000));

const saveOtpCode = (store, { purpose, identifier }) => {
  const code = createDemoCode();
  const nextCode = {
    id: generateId('code'),
    purpose,
    identifier,
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  };

  store.otpCodes = store.otpCodes.filter(
    (entry) => !(entry.purpose === purpose && entry.identifier === identifier)
  );
  store.otpCodes.push(nextCode);
  writeStore(store);
  return code;
};

const verifyOtpCode = (store, { purpose, identifier, code }) => {
  const otpCode = store.otpCodes.find(
    (entry) => entry.purpose === purpose && entry.identifier === identifier
  );

  if (!otpCode) {
    throw createError('Verification code not found. Please request a new one.', 404);
  }

  if (otpCode.expiresAt < Date.now()) {
    store.otpCodes = store.otpCodes.filter((entry) => entry.id !== otpCode.id);
    writeStore(store);
    throw createError('Verification code expired. Please request a new one.', 410);
  }

  if (trimText(code) !== otpCode.code) {
    throw createError('Invalid verification code', 400);
  }

  store.otpCodes = store.otpCodes.filter((entry) => entry.id !== otpCode.id);
  writeStore(store);
};

const findUserByContact = (store, contact) =>
  store.users.find((user) =>
    contact.type === 'email' ? user.email === contact.value : user.phone === contact.value
  );

const findUserByIdentifier = (store, identifier = '') => {
  const contact = resolveContact(identifier);
  if (!contact) {
    return null;
  }

  return findUserByContact(store, contact);
};

const ensureUniqueUsernameAndContact = (store, { username, contact, excludeUserId = '' }) => {
  const duplicateUser = store.users.find((user) => {
    if (user.id === excludeUserId) {
      return false;
    }

    return (
      user.username === username ||
      (contact?.type === 'email' && user.email === contact.value) ||
      (contact?.type === 'phone' && user.phone === contact.value)
    );
  });

  if (duplicateUser) {
    throw createError('Email, mobile number, or username already exists', 409);
  }
};

const buildPollinationsUrl = (prompt, ratio = '1:1') => {
  const preset = ASPECT_RATIO_PRESETS[ratio] || ASPECT_RATIO_PRESETS['1:1'];
  const seed = Math.floor(Math.random() * 2147483647) + 1;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${preset.width}&height=${preset.height}&seed=${seed}&nologo=true`;
};

const normalizeImage = (image) => ({
  ...image,
  _id: image.id,
});

const serializeGalleryPost = (post, viewerUserId = '') => ({
  _id: post.id,
  userId: post.userId,
  username: post.username,
  userAvatarUrl: post.userAvatarUrl || '',
  title: post.title,
  description: post.description || '',
  prompt: post.prompt || '',
  imageUrl: post.imageUrl,
  source: post.source || 'upload',
  createdAt: post.createdAt,
  likesCount: Array.isArray(post.likedBy) ? post.likedBy.length : 0,
  likedByCurrentUser: viewerUserId ? (post.likedBy || []).includes(viewerUserId) : false,
  shareCount: Number(post.shareCount || 0),
  authorFollowersCount: Number(post.authorFollowersCount || 0),
  followingAuthor: viewerUserId ? Boolean(post.followingAuthorUserIds?.includes(viewerUserId)) : false,
});

const syncUserDependentPosts = (store, user) => {
  store.galleryPosts = store.galleryPosts.map((post) =>
    post.userId === user.id
      ? {
          ...post,
          username: user.username,
          userAvatarUrl: user.avatarUrl || '',
          authorFollowersCount: user.followers.length,
        }
      : post
  );
};

const buildAssistantReply = (prompt = '') => {
  const normalizedPrompt = trimText(prompt).toLowerCase();

  if (normalizedPrompt.includes('login') || normalizedPrompt.includes('log in')) {
    return 'GitHub Pages demo me login browser-local hai. Email ya mobile se account banao aur wahi browser me use karo.';
  }

  if (normalizedPrompt.includes('video')) {
    return 'Free demo deploy me video tools disabled hain. Image generation aur browser-local account features available hain.';
  }

  if (normalizedPrompt.includes('explore') || normalizedPrompt.includes('gallery')) {
    return 'Explore aur community demo mode me browser-local store use karte hain, isliye posts isi browser me visible rahenge.';
  }

  if (normalizedPrompt.includes('profile')) {
    return 'Dashboard ke Profile tab me username aur avatar update kar sakte ho. Changes is browser ke local demo store me save honge.';
  }

  return 'Yeh free demo deploy hai. Image generation, signup/login, history, aur profile browser-local mode me kaam karte hain.';
};

const getCurrentViewerId = (options = {}) => parseToken(options);

const handleAuthSignupCode = (store, body) => {
  const contact = resolveContact(body.identifier);
  if (!contact) {
    throw createError('Please enter a valid email address or mobile number.', 400);
  }

  if (findUserByContact(store, contact)) {
    throw createError('An account already exists with this email or mobile number', 409);
  }

  const code = saveOtpCode(store, {
    purpose: SIGNUP_CODE_PURPOSE,
    identifier: contact.value,
  });

  return {
    message: `Verification code sent to your ${contact.type}`,
    delivery: {
      channel: contact.type,
      delivered: false,
      mode: 'demo',
      provider: 'local-demo',
    },
    debugCode: code,
  };
};

const handleSignup = (store, body) => {
  const username = trimText(body.username);
  const contact = resolveContact(body.identifier);
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');
  const code = trimText(body.code);

  if (!username || !contact || !password || !confirmPassword || !code) {
    throw createError('All fields are required', 400);
  }

  if (username.length < 3) {
    throw createError('Username must be at least 3 characters long', 400);
  }

  if (password !== confirmPassword) {
    throw createError('Passwords do not match', 400);
  }

  if (!validatePassword(password)) {
    throw createError('Password must be at least 8 characters with uppercase, lowercase, and number', 400);
  }

  ensureUniqueUsernameAndContact(store, { username, contact });
  verifyOtpCode(store, {
    purpose: SIGNUP_CODE_PURPOSE,
    identifier: contact.value,
    code,
  });

  const user = {
    id: generateId('user'),
    username,
    email: contact.type === 'email' ? contact.value : '',
    phone: contact.type === 'phone' ? contact.value : '',
    password,
    avatarUrl: '',
    followers: [],
    following: [],
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  writeStore(store);

  return {
    message: 'User created successfully',
    token: createToken(user.id),
    user: serializeUser(user),
  };
};

const handleLogin = (store, body) => {
  const identifier = body.identifier || body.email || body.phone;
  const password = String(body.password || '');

  if (!identifier || !password) {
    throw createError('Email/mobile number and password are required', 400);
  }

  const user = findUserByIdentifier(store, identifier);
  if (!user || user.password !== password) {
    throw createError('Invalid email/mobile number or password', 401);
  }

  return {
    message: 'Login successful',
    token: createToken(user.id),
    user: serializeUser(user),
    rememberMe: Boolean(body.rememberMe),
  };
};

const handlePasswordResetCode = (store, body) => {
  const contact = resolveContact(body.identifier);
  if (!contact) {
    throw createError('Please enter a valid email address or mobile number.', 400);
  }

  const user = findUserByContact(store, contact);
  if (!user) {
    throw createError('No account found with this email or mobile number', 404);
  }

  const code = saveOtpCode(store, {
    purpose: RESET_CODE_PURPOSE,
    identifier: contact.value,
  });

  return {
    message: `Password reset code sent to your ${contact.type}`,
    delivery: {
      channel: contact.type,
      delivered: false,
      mode: 'demo',
      provider: 'local-demo',
    },
    debugCode: code,
  };
};

const handlePasswordReset = (store, body) => {
  const contact = resolveContact(body.identifier);
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!contact || !trimText(body.code) || !password || !confirmPassword) {
    throw createError('All fields are required', 400);
  }

  if (password !== confirmPassword) {
    throw createError('Passwords do not match', 400);
  }

  if (!validatePassword(password)) {
    throw createError('Password must be at least 8 characters with uppercase, lowercase, and number', 400);
  }

  const user = findUserByContact(store, contact);
  if (!user) {
    throw createError('No account found with this email or mobile number', 404);
  }

  verifyOtpCode(store, {
    purpose: RESET_CODE_PURPOSE,
    identifier: contact.value,
    code: body.code,
  });

  user.password = password;
  writeStore(store);

  return {
    message: 'Password reset successful. Please log in with your new password.',
  };
};

const handleUserProfile = (store, options) => {
  const user = ensureAuthenticatedUser(store, options);
  return { user: serializeUser(user) };
};

const handleUpdateProfile = (store, options, body) => {
  const user = ensureAuthenticatedUser(store, options);
  const nextUsername = trimText(body.username);
  const nextAvatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl : user.avatarUrl || '';

  if (!nextUsername) {
    throw createError('Username is required', 400);
  }

  ensureUniqueUsernameAndContact(store, {
    username: nextUsername,
    contact: null,
    excludeUserId: user.id,
  });

  user.username = nextUsername;
  user.avatarUrl = nextAvatarUrl;
  syncUserDependentPosts(store, user);
  writeStore(store);

  return {
    message: 'Profile updated successfully',
    user: serializeUser(user),
  };
};

const handlePublicProfile = (store, options, userId) => {
  const targetUser = store.users.find((user) => user.id === userId);
  if (!targetUser) {
    throw createError('User not found', 404);
  }

  const viewerId = getCurrentViewerId(options);
  const posts = store.galleryPosts
    .filter((post) => post.userId === userId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((post) => ({
      ...serializeGalleryPost(
        {
          ...post,
          followingAuthorUserIds: targetUser.followers,
        },
        viewerId
      ),
      likedByCurrentUser: viewerId ? (post.likedBy || []).includes(viewerId) : false,
    }));

  return {
    user: {
      _id: targetUser.id,
      id: targetUser.id,
      username: targetUser.username,
      avatarUrl: targetUser.avatarUrl || '',
      createdAt: targetUser.createdAt,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length,
    },
    posts,
    totalPublicPosts: posts.length,
    isCurrentUser: viewerId === userId,
    isFollowing: viewerId ? targetUser.followers.includes(viewerId) : false,
    canFollow: Boolean(viewerId && viewerId !== userId),
  };
};

const handleFollowUser = (store, options, targetUserId) => {
  const currentUser = ensureAuthenticatedUser(store, options);
  const targetUser = store.users.find((user) => user.id === targetUserId);

  if (!targetUser) {
    throw createError('User not found', 404);
  }

  if (currentUser.id === targetUserId) {
    throw createError('You cannot follow yourself', 400);
  }

  const isFollowing = currentUser.following.includes(targetUserId);
  currentUser.following = isFollowing
    ? currentUser.following.filter((entry) => entry !== targetUserId)
    : [...currentUser.following, targetUserId];
  targetUser.followers = isFollowing
    ? targetUser.followers.filter((entry) => entry !== currentUser.id)
    : [...targetUser.followers, currentUser.id];

  syncUserDependentPosts(store, targetUser);
  writeStore(store);

  return {
    message: isFollowing ? 'User unfollowed successfully' : 'User followed successfully',
    following: !isFollowing,
    currentUser: serializeUser(currentUser),
    targetUser: serializeUser(targetUser),
  };
};

const handleGenerateImage = (store, options, body) => {
  const user = ensureAuthenticatedUser(store, options);
  const prompt = trimText(body.prompt);

  if (!prompt) {
    throw createError('Prompt is required', 400);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw createError(`Prompt must be less than ${MAX_PROMPT_LENGTH} characters`, 400);
  }

  const ratio = ASPECT_RATIO_PRESETS[body.ratio] ? body.ratio : '1:1';
  const quality = ['fast', 'balanced', 'high'].includes(body.quality) ? body.quality : 'balanced';
  const image = {
    id: generateId('img'),
    userId: user.id,
    prompt,
    imageUrl: buildPollinationsUrl(prompt, ratio),
    ratio,
    quality,
    generatedAt: new Date().toISOString(),
  };

  store.images.unshift(image);
  writeStore(store);

  return {
    message: 'Image generated successfully',
    image,
  };
};

const handleImageHistory = (store, options, searchParams) => {
  const user = ensureAuthenticatedUser(store, options);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.max(1, Number(searchParams.get('limit')) || 10);
  const userImages = store.images.filter((image) => image.userId === user.id);
  const start = (page - 1) * limit;
  const paginatedImages = userImages.slice(start, start + limit).map(normalizeImage);

  return {
    images: paginatedImages,
    total: userImages.length,
    pages: Math.max(1, Math.ceil(userImages.length / limit)),
    currentPage: page,
  };
};

const handleDeleteImage = (store, options, imageId) => {
  const user = ensureAuthenticatedUser(store, options);
  const image = store.images.find((entry) => entry.id === imageId);

  if (!image) {
    throw createError('Image not found', 404);
  }

  if (image.userId !== user.id) {
    throw createError('Unauthorized', 403);
  }

  store.images = store.images.filter((entry) => entry.id !== imageId);
  writeStore(store);

  return {
    message: 'Image deleted successfully',
  };
};

const handleGalleryPosts = (store, options, searchParams) => {
  const viewerId = getCurrentViewerId(options);
  const searchTerm = trimText(searchParams.get('search')).toLowerCase();
  const limit = Math.max(1, Number(searchParams.get('limit')) || 18);

  const posts = store.galleryPosts
    .filter((post) => {
      if (!searchTerm) {
        return true;
      }

      const haystack = [post.title, post.description, post.prompt, post.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    })
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, limit)
    .map((post) => {
      const author = store.users.find((user) => user.id === post.userId);
      return serializeGalleryPost(
        {
          ...post,
          authorFollowersCount: author?.followers.length || 0,
          followingAuthorUserIds: author?.followers || [],
        },
        viewerId
      );
    });

  return {
    posts,
  };
};

const handleCreateGalleryPost = (store, options, body) => {
  const user = ensureAuthenticatedUser(store, options);
  const title = trimText(body.title);
  const imageUrl = trimText(body.imageUrl);

  if (!title || !imageUrl) {
    throw createError('Title and image are required', 400);
  }

  const post = {
    id: generateId('post'),
    userId: user.id,
    username: user.username,
    userAvatarUrl: user.avatarUrl || '',
    title,
    description: trimText(body.description),
    prompt: trimText(body.prompt),
    imageUrl,
    source: body.source === 'generated' ? 'generated' : 'upload',
    likedBy: [],
    shareCount: 0,
    createdAt: new Date().toISOString(),
  };

  store.galleryPosts.unshift(post);
  writeStore(store);

  return {
    message: 'Image published successfully',
    post: serializeGalleryPost(
      {
        ...post,
        authorFollowersCount: user.followers.length,
        followingAuthorUserIds: user.followers,
      },
      user.id
    ),
  };
};

const handleToggleLike = (store, options, postId) => {
  const user = ensureAuthenticatedUser(store, options);
  const post = store.galleryPosts.find((entry) => entry.id === postId);

  if (!post) {
    throw createError('Post not found', 404);
  }

  const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
  post.likedBy = likedBy.includes(user.id)
    ? likedBy.filter((entry) => entry !== user.id)
    : [...likedBy, user.id];

  writeStore(store);

  const author = store.users.find((entry) => entry.id === post.userId);
  return {
    message: 'Like status updated',
    post: serializeGalleryPost(
      {
        ...post,
        authorFollowersCount: author?.followers.length || 0,
        followingAuthorUserIds: author?.followers || [],
      },
      user.id
    ),
  };
};

const handleSharePost = (store, options, postId) => {
  const viewerId = getCurrentViewerId(options);
  const post = store.galleryPosts.find((entry) => entry.id === postId);

  if (!post) {
    throw createError('Post not found', 404);
  }

  post.shareCount = Number(post.shareCount || 0) + 1;
  writeStore(store);

  const author = store.users.find((entry) => entry.id === post.userId);
  const shareUrl = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/explore#post-${postId}`
    .replace('/explore/explore', '/explore');

  return {
    message: 'Share link ready',
    shareUrl,
    post: serializeGalleryPost(
      {
        ...post,
        authorFollowersCount: author?.followers.length || 0,
        followingAuthorUserIds: author?.followers || [],
      },
      viewerId
    ),
  };
};

export const handleDemoApiRequest = async (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const store = readStore();
  const url = new URL(path, 'https://demo.local');
  const body = getBody(options);

  if (url.pathname === '/api/auth/check-password-strength' && method === 'POST') {
    return {
      strength: getPasswordStrength(String(body.password || '')),
    };
  }

  if (url.pathname === '/api/auth/send-signup-code' && method === 'POST') {
    return handleAuthSignupCode(store, body);
  }

  if (url.pathname === '/api/auth/signup' && method === 'POST') {
    return handleSignup(store, body);
  }

  if (url.pathname === '/api/auth/login' && method === 'POST') {
    return handleLogin(store, body);
  }

  if (url.pathname === '/api/auth/send-password-reset-code' && method === 'POST') {
    return handlePasswordResetCode(store, body);
  }

  if (url.pathname === '/api/auth/reset-password' && method === 'POST') {
    return handlePasswordReset(store, body);
  }

  if (url.pathname === '/api/user/profile' && method === 'GET') {
    return handleUserProfile(store, options);
  }

  if (url.pathname === '/api/user/profile' && method === 'PUT') {
    return handleUpdateProfile(store, options, body);
  }

  const publicProfileMatch = url.pathname.match(/^\/api\/user\/([^/]+)\/profile$/);
  if (publicProfileMatch && method === 'GET') {
    return handlePublicProfile(store, options, publicProfileMatch[1]);
  }

  const followUserMatch = url.pathname.match(/^\/api\/user\/([^/]+)\/follow$/);
  if (followUserMatch && method === 'POST') {
    return handleFollowUser(store, options, followUserMatch[1]);
  }

  if (url.pathname === '/api/image/generate' && method === 'POST') {
    return handleGenerateImage(store, options, body);
  }

  if (url.pathname === '/api/image/history' && method === 'GET') {
    return handleImageHistory(store, options, url.searchParams);
  }

  const deleteImageMatch = url.pathname.match(/^\/api\/image\/([^/]+)$/);
  if (deleteImageMatch && method === 'DELETE') {
    return handleDeleteImage(store, options, deleteImageMatch[1]);
  }

  if (url.pathname === '/api/image/video-status' && method === 'GET') {
    ensureAuthenticatedUser(store, options);
    return { video: DEFAULT_VIDEO_STATUS };
  }

  if ((url.pathname === '/api/image/generate-video' || url.pathname === '/api/image/animate') && method === 'POST') {
    ensureAuthenticatedUser(store, options);
    throw createError(DEFAULT_VIDEO_STATUS.message, 501);
  }

  if (url.pathname === '/api/gallery/posts' && method === 'GET') {
    return handleGalleryPosts(store, options, url.searchParams);
  }

  if (url.pathname === '/api/gallery/posts' && method === 'POST') {
    return handleCreateGalleryPost(store, options, body);
  }

  const likePostMatch = url.pathname.match(/^\/api\/gallery\/posts\/([^/]+)\/like$/);
  if (likePostMatch && method === 'POST') {
    return handleToggleLike(store, options, likePostMatch[1]);
  }

  const sharePostMatch = url.pathname.match(/^\/api\/gallery\/posts\/([^/]+)\/share$/);
  if (sharePostMatch && method === 'POST') {
    return handleSharePost(store, options, sharePostMatch[1]);
  }

  if (url.pathname === '/api/assistant/status' && method === 'GET') {
    return {
      available: true,
      liveTalkAvailable: false,
      voiceRepliesAvailable: false,
      provider: 'demo-local',
      message: 'Free demo mode active',
    };
  }

  if (url.pathname === '/api/assistant/chat' && method === 'POST') {
    const latestMessage = Array.isArray(body.messages)
      ? body.messages[body.messages.length - 1]?.content || ''
      : body.prompt || '';

    return {
      reply: buildAssistantReply(latestMessage),
    };
  }

  if (url.pathname === '/api/assistant/remember' && method === 'POST') {
    return {
      ok: true,
    };
  }

  if (
    (url.pathname === '/api/assistant/speak' ||
      url.pathname === '/api/assistant/transcribe' ||
      url.pathname === '/api/assistant/live-session') &&
    method === 'POST'
  ) {
    throw createError('Voice features are disabled in the free GitHub Pages demo.', 501);
  }

  if (url.pathname === '/api/health' && method === 'GET') {
    return {
      status: 'Demo mode running',
    };
  }

  throw createError(`Demo mode does not support ${method} ${url.pathname}`, 404);
};
