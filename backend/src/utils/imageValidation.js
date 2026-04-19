const MAX_AVATAR_DATA_URL_LENGTH = 3_000_000;
const MAX_GALLERY_IMAGE_DATA_URL_LENGTH = 8_000_000;
const MAX_VIDEO_SOURCE_DATA_URL_LENGTH = 8_000_000;

const isImageDataUrl = (value) =>
  typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
const isHttpImageUrl = (value) =>
  typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value);

const isValidAvatarInput = (value) =>
  value === '' || value == null || (isImageDataUrl(value) && value.length <= MAX_AVATAR_DATA_URL_LENGTH);

const isValidGalleryImageInput = (value, source = 'upload') => {
  const isDataUrlValid = isImageDataUrl(value) && value.length <= MAX_GALLERY_IMAGE_DATA_URL_LENGTH;

  if (source === 'generated') {
    return isDataUrlValid || isHttpImageUrl(value);
  }

  return isDataUrlValid;
};

const isValidVideoSourceInput = (value) =>
  isImageDataUrl(value) && value.length <= MAX_VIDEO_SOURCE_DATA_URL_LENGTH;

module.exports = {
  MAX_AVATAR_DATA_URL_LENGTH,
  MAX_GALLERY_IMAGE_DATA_URL_LENGTH,
  MAX_VIDEO_SOURCE_DATA_URL_LENGTH,
  isHttpImageUrl,
  isImageDataUrl,
  isValidAvatarInput,
  isValidGalleryImageInput,
  isValidVideoSourceInput,
};
