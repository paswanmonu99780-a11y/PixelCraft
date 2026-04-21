const trimTrailingSlash = (value = '') => value.replace(/\/$/, '');

const getDefaultBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { hostname } = window.location;
  const isLocalDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';

  return isLocalDevelopment ? 'http://localhost:5000' : window.location.origin;
};

const rawBaseUrl = trimTrailingSlash(process.env.REACT_APP_API_URL || getDefaultBaseUrl());
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl.slice(0, -4) : rawBaseUrl;

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

export const getJson = async (path, options = {}) => {
  try {
    const response = await fetch(apiUrl(path), options);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || 'Request failed');
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } catch (err) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      const serverInfo = process.env.REACT_APP_API_URL
        ? `API URL: ${process.env.REACT_APP_API_URL}`
        : `Expected backend at: ${apiUrl('')}`;
      const message = `Cannot connect to server.\n\nPlease ensure the backend server is running.\n\n${serverInfo}`;
      const friendlyErr = new Error(message);
      friendlyErr.status = err.status || 0;
      throw friendlyErr;
    }
    throw err;
  }
};
