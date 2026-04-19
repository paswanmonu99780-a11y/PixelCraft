import { apiUrl } from './api';

const isDataUrl = (value = '') => value.startsWith('data:');
const isRemoteUrl = (value = '') => /^https?:\/\//i.test(value);
const isProxyPreviewUrl = (value = '') => value.includes('/api/image/preview?');

export const resolveDownloadUrl = (assetUrl = '', assetType = 'image') => {
  if (!assetUrl || isDataUrl(assetUrl)) {
    return assetUrl;
  }

  if (assetType === 'image') {
    if (isProxyPreviewUrl(assetUrl)) {
      return isRemoteUrl(assetUrl) ? assetUrl : apiUrl(assetUrl);
    }

    if (isRemoteUrl(assetUrl)) {
      return apiUrl(`/api/image/preview?source=${encodeURIComponent(assetUrl)}`);
    }
  }

  if (isRemoteUrl(assetUrl)) {
    return assetUrl;
  }

  return apiUrl(assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`);
};

export const downloadAsset = async ({ assetUrl = '', fileName = 'download', assetType = 'image' } = {}) => {
  const resolvedUrl = resolveDownloadUrl(assetUrl, assetType);

  if (!resolvedUrl) {
    throw new Error('Download source is missing');
  }

  if (isDataUrl(resolvedUrl)) {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error('Download failed');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};
