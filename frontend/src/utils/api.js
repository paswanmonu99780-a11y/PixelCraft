import { handleDemoApiRequest } from './demoApi';

const trimTrailingSlash = (value = '') => value.replace(/\/$/, '');

const isGitHubPagesHost = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return /\.github\.io$/i.test(window.location.hostname);
};

export const isDemoMode = () =>
  process.env.REACT_APP_DEMO_MODE === 'true' || isGitHubPagesHost();

const getDefaultBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { hostname, origin } = window.location;
  const isLocalDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';

  return isLocalDevelopment ? 'http://localhost:5000' : origin;
};

const rawBaseUrl = trimTrailingSlash(process.env.REACT_APP_API_URL || getDefaultBaseUrl());
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl.slice(0, -4) : rawBaseUrl;

export const apiUrl = (path) => {
  if (isDemoMode() && typeof window !== 'undefined' && path.startsWith('/api/image/preview')) {
    try {
      const url = new URL(path, window.location.origin);
      return url.searchParams.get('source') || `${API_BASE_URL}${path}`;
    } catch (error) {
      return `${API_BASE_URL}${path}`;
    }
  }

  return `${API_BASE_URL}${path}`;
};

export const getJson = async (path, options = {}) => {
  if (isDemoMode() && path.startsWith('/api/')) {
    return handleDemoApiRequest(path, options);
  }

  const response = await fetch(apiUrl(path), options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};
