const crypto = require('crypto');
const GalleryPost = require('../models/GalleryPost');
const User = require('../models/User');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const { isValidGalleryImageInput } = require('../utils/imageValidation');
const { normalizeId, normalizeIdList, serializeUser } = require('../utils/userSerializer');
const {
  GALLERY_UPLOAD_REWARD,
  POST_LIKE_REWARD,
  addRewardMarker,
  addTokensToUser,
  ensureUserTokenState,
  hasRewardMarker,
} = require('../utils/tokenUtils');

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 500;

const getCurrentUser = async (userId) => {
  if (shouldUseMemoryStore()) {
    return memoryStore.getUserRecordById(userId);
  }

  return User.findById(userId).select('-password');
};

const getViewerFollowingIds = async (viewerUserId) => {
  if (!viewerUserId) return [];

  if (shouldUseMemoryStore()) {
    const viewer = await memoryStore.getUserRecordById(viewerUserId);
    return normalizeIdList(viewer?.following);
  }

  const viewer = await User.findById(viewerUserId).select('following').lean();
  return normalizeIdList(viewer?.following);
};

const serializeGalleryPost = (post, { viewerUserId = '', viewerFollowingIds = [] } = {}) => {
  const normalizedViewerId = normalizeId(viewerUserId);
  const likedBy = normalizeIdList(post.likedBy);
  const authorId = normalizeId(post.userId);
  const comments = Array.isArray(post.comments)
    ? post.comments
        .map((comment) => ({
          _id: normalizeId(comment._id) || String(comment._id || ''),
          userId: normalizeId(comment.userId),
          username: comment.username,
          userAvatarUrl: comment.userAvatarUrl || '',
          content: comment.content || '',
          createdAt: comment.createdAt,
        }))
        .filter((comment) => comment.userId && comment.content)
    : [];

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
    likedByCurrentUser: normalizedViewerId ? likedBy.includes(normalizedViewerId) : false,
    shareCount: Number(post.shareCount || 0),
    followingAuthor: normalizedViewerId ? viewerFollowingIds.includes(authorId) : false,
    authorFollowersCount: Number(post.authorFollowersCount || 0),
    commentsCount: comments.length,
    comments,
  };
};

const getFrontendBaseUrl = (req) => {
  const configuredOrigin = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .find(Boolean);

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  const forwardedProtocol = req.headers['x-forwarded-proto']?.split(',')[0];
  const protocol = forwardedProtocol || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
};

const getShareUrl = (req, postId) => `${getFrontendBaseUrl(req)}/explore#post-${postId}`;

exports.getPublicGalleryPosts = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12 } = req.query;
    const viewerFollowingIds = await getViewerFollowingIds(req.userId);

    if (shouldUseMemoryStore()) {
      const result = await memoryStore.getPublicGalleryPosts({
        search,
        page,
        limit,
        viewerUserId: req.userId,
      });

      return res.json(result);
    }

    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 12;
    const trimmedSearch = String(search || '').trim();
    const query = trimmedSearch
      ? {
          $or: [
            { title: { $regex: trimmedSearch, $options: 'i' } },
            { description: { $regex: trimmedSearch, $options: 'i' } },
            { prompt: { $regex: trimmedSearch, $options: 'i' } },
            { username: { $regex: trimmedSearch, $options: 'i' } },
          ],
        }
      : {};

    const posts = await GalleryPost.find(query)
      .sort({ createdAt: -1 })
      .limit(numericLimit)
      .skip((numericPage - 1) * numericLimit)
      .lean();

    const total = await GalleryPost.countDocuments(query);

    res.json({
      posts: posts.map((post) =>
        serializeGalleryPost(post, {
          viewerUserId: req.userId,
          viewerFollowingIds,
        })
      ),
      total,
      pages: Math.max(1, Math.ceil(total / numericLimit)),
      currentPage: numericPage,
    });
  } catch (error) {
    console.error('Public gallery retrieval error:', error);
    res.status(500).json({ error: 'Failed to load explore gallery' });
  }
};

exports.createGalleryPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description = '', prompt = '', imageUrl, source = 'upload' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (title.trim().length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title must be under ${MAX_TITLE_LENGTH} characters` });
    }

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return res.status(400).json({ error: `Description must be under ${MAX_DESCRIPTION_LENGTH} characters` });
    }

    if (!isValidGalleryImageInput(imageUrl, source)) {
      return res.status(400).json({ error: 'Please upload a valid image file' });
    }

    const user = await getCurrentUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    ensureUserTokenState(user);

    let post;

    if (shouldUseMemoryStore()) {
      post = await memoryStore.createGalleryPost({
        userId,
        username: user.username,
        userAvatarUrl: user.avatarUrl || '',
        authorFollowersCount: normalizeIdList(user.followers).length,
        title,
        description,
        prompt,
        imageUrl,
        source,
      });
    } else {
      post = await GalleryPost.create({
        userId,
        username: user.username,
        userAvatarUrl: user.avatarUrl || '',
        title: title.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        imageUrl,
        source,
        likedBy: [],
        shareCount: 0,
        authorFollowersCount: normalizeIdList(user.followers).length,
        comments: [],
      });
    }

    let message = 'Post published successfully';

    if (String(source || 'upload') === 'upload') {
      addTokensToUser(user, GALLERY_UPLOAD_REWARD, 'gallery-upload', 'Public image upload reward');
      message = `Post published successfully. +${GALLERY_UPLOAD_REWARD} tokens awarded.`;
    }

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await user.save();
    }

    res.status(201).json({
      message,
      post: serializeGalleryPost(post, {
        viewerUserId: userId,
        viewerFollowingIds: normalizeIdList(user.following),
      }),
      currentUser: serializeUser(user),
    });
  } catch (error) {
    console.error('Gallery publish error:', error);
    res.status(500).json({ error: 'Failed to publish image' });
  }
};

exports.togglePostLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerUserId = req.userId;

    const [post, currentUser] = shouldUseMemoryStore()
      ? await Promise.all([
          memoryStore.findGalleryPostById(postId),
          memoryStore.getUserRecordById(viewerUserId),
        ])
      : await Promise.all([
          GalleryPost.findById(postId),
          User.findById(viewerUserId).select('-password'),
        ]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    ensureUserTokenState(currentUser);

    const normalizedViewerId = normalizeId(viewerUserId);
    const likedBy = normalizeIdList(post.likedBy);
    const isLiked = likedBy.includes(normalizedViewerId);
    let message = isLiked ? 'Like removed successfully' : 'Post liked successfully';

    post.likedBy = isLiked
      ? post.likedBy.filter((id) => id.toString() !== normalizedViewerId)
      : [...post.likedBy, viewerUserId];

    if (!isLiked && normalizeId(post.userId) !== normalizedViewerId && !hasRewardMarker(currentUser, 'rewardedLikePostIds', postId)) {
      addRewardMarker(currentUser, 'rewardedLikePostIds', postId);
      addTokensToUser(currentUser, POST_LIKE_REWARD, 'post-like', 'First like reward for a post');
      message = `${message} +${POST_LIKE_REWARD} tokens awarded.`;
    }

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await Promise.all([
        post.save(),
        currentUser.save(),
      ]);
    }

    const viewerFollowingIds = normalizeIdList(currentUser.following);

    const serializedPost = serializeGalleryPost(post, {
      viewerUserId,
      viewerFollowingIds,
    });

    res.json({
      message,
      post: serializedPost,
      currentUser: serializeUser(currentUser),
    });
  } catch (error) {
    console.error('Post like error:', error);
    res.status(500).json({ error: 'Failed to update like status' });
  }
};

exports.addPostComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const content = String(req.body?.content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `Comment must be under ${MAX_COMMENT_LENGTH} characters` });
    }

    const [post, currentUser] = shouldUseMemoryStore()
      ? await Promise.all([
          memoryStore.findGalleryPostById(postId),
          memoryStore.getUserRecordById(userId),
        ])
      : await Promise.all([
          GalleryPost.findById(postId),
          User.findById(userId).select('-password'),
        ]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextComment = {
      _id: shouldUseMemoryStore() ? crypto.randomUUID() : undefined,
      userId,
      username: currentUser.username,
      userAvatarUrl: currentUser.avatarUrl || '',
      content,
      createdAt: new Date().toISOString(),
    };

    post.comments = [...(Array.isArray(post.comments) ? post.comments : []), nextComment];

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await post.save();
    }

    res.status(201).json({
      message: 'Comment added successfully',
      post: serializeGalleryPost(post, {
        viewerUserId: userId,
        viewerFollowingIds: normalizeIdList(currentUser.following),
      }),
      currentUser: serializeUser(currentUser),
    });
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

exports.sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerFollowingIds = await getViewerFollowingIds(req.userId);
    const shareUrl = getShareUrl(req, postId);

    if (shouldUseMemoryStore()) {
      const post = await memoryStore.incrementGalleryPostShare(postId, req.userId);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      return res.json({
        message: 'Share link ready',
        shareUrl,
        post,
      });
    }

    const post = await GalleryPost.findByIdAndUpdate(
      postId,
      { $inc: { shareCount: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      message: 'Share link ready',
      shareUrl,
      post: serializeGalleryPost(post, {
        viewerUserId: req.userId,
        viewerFollowingIds,
      }),
    });
  } catch (error) {
    console.error('Post share error:', error);
    res.status(500).json({ error: 'Failed to prepare share link' });
  }
};
