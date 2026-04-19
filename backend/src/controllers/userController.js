const User = require('../models/User');
const GalleryPost = require('../models/GalleryPost');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const { isValidAvatarInput } = require('../utils/imageValidation');
const { normalizeId, normalizeIdList, serializeUser } = require('../utils/userSerializer');

const serializePublicUser = (user) => {
  const serializedUser = serializeUser(user);

  if (!serializedUser) {
    return null;
  }

  return {
    _id: serializedUser.id,
    id: serializedUser.id,
    username: serializedUser.username,
    avatarUrl: serializedUser.avatarUrl,
    createdAt: serializedUser.createdAt,
    followersCount: serializedUser.followersCount,
    followingCount: serializedUser.followingCount,
  };
};

const serializePublicGalleryPost = (post, viewerUserId = '') => {
  const normalizedViewerUserId = normalizeId(viewerUserId);
  const likedBy = normalizeIdList(post.likedBy);
  const authorId = normalizeId(post.userId);

  return {
    _id: normalizeId(post._id),
    userId: authorId,
    username: post.username,
    userAvatarUrl: post.userAvatarUrl || '',
    title: post.title,
    description: post.description || '',
    prompt: post.prompt || '',
    imageUrl: post.imageUrl,
    source: post.source || 'upload',
    createdAt: post.createdAt,
    likesCount: likedBy.length,
    likedByCurrentUser: normalizedViewerUserId ? likedBy.includes(normalizedViewerUserId) : false,
    shareCount: Number(post.shareCount || 0),
    authorFollowersCount: Number(post.authorFollowersCount || 0),
  };
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const user = shouldUseMemoryStore()
      ? await memoryStore.findUserById(userId)
      : await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { username, avatarUrl } = req.body;
    const updates = {};

    if (typeof username === 'string') {
      if (username.trim().length === 0) {
        return res.status(400).json({ error: 'Username is required' });
      }
      updates.username = username;
    }

    if (avatarUrl !== undefined) {
      if (!isValidAvatarInput(avatarUrl)) {
        return res.status(400).json({ error: 'Please upload a valid profile image' });
      }
      updates.avatarUrl = avatarUrl || '';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No profile changes provided' });
    }

    const user = shouldUseMemoryStore()
      ? await memoryStore.updateUser(userId, updates)
      : await User.findByIdAndUpdate(
          userId,
          updates,
          { new: true, runValidators: true }
        ).select('-password');

    res.json({ message: 'Profile updated successfully', user: serializeUser(user) });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

exports.getPublicUserProfile = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const viewerUserId = req.userId || '';

    if (shouldUseMemoryStore()) {
      const result = await memoryStore.getPublicUserProfile({
        targetUserId,
        viewerUserId,
      });

      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result);
    }

    const [targetUser, viewer] = await Promise.all([
      User.findById(targetUserId).select('-password'),
      viewerUserId ? User.findById(viewerUserId).select('following').lean() : null,
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const viewerFollowingIds = normalizeIdList(viewer?.following);
    const normalizedTargetUserId = normalizeId(targetUser);
    const posts = await GalleryPost.find({ userId: targetUser._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      user: serializePublicUser(targetUser),
      posts: posts.map((post) => serializePublicGalleryPost(post, viewerUserId)),
      totalPublicPosts: posts.length,
      isCurrentUser: viewerUserId === normalizedTargetUserId,
      isFollowing: viewerFollowingIds.includes(normalizedTargetUserId),
      canFollow: Boolean(viewerUserId && viewerUserId !== normalizedTargetUserId),
    });
  } catch (error) {
    console.error('Public profile retrieval error:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(500).json({ error: 'Failed to retrieve public profile' });
  }
};

exports.toggleFollowUser = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    if (shouldUseMemoryStore()) {
      const result = await memoryStore.toggleFollowUser(currentUserId, targetUserId);

      return res.json({
        message: result.following ? 'User followed successfully' : 'User unfollowed successfully',
        following: result.following,
        currentUser: result.currentUser,
        targetUser: result.targetUser,
      });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select('-password'),
      User.findById(targetUserId).select('-password'),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isFollowing = currentUser.following.some((id) => id.toString() === targetUserId);

    currentUser.following = isFollowing
      ? currentUser.following.filter((id) => id.toString() !== targetUserId)
      : [...currentUser.following, targetUser._id];

    targetUser.followers = isFollowing
      ? targetUser.followers.filter((id) => id.toString() !== currentUserId)
      : [...targetUser.followers, currentUser._id];

    await Promise.all([
      currentUser.save(),
      targetUser.save(),
      GalleryPost.updateMany(
        { userId: targetUser._id },
        { authorFollowersCount: targetUser.followers.length }
      ),
    ]);

    res.json({
      message: isFollowing ? 'User unfollowed successfully' : 'User followed successfully',
      following: !isFollowing,
      currentUser: serializeUser(currentUser),
      targetUser: serializeUser(targetUser),
    });
  } catch (error) {
    console.error('Follow toggle error:', error);
    res.status(500).json({ error: 'Failed to update follow status' });
  }
};
