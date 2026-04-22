const trimTrailingSlash = (value = '') => value.replace(/\/$/, '');

// Force use of explicit backend URL
const getBaseUrl = () => {
  // Always use localhost:5000 for development
  if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim() !== '') {
    const url = trimTrailingSlash(process.env.REACT_APP_API_URL);
    return url.endsWith('/api') ? url.slice(0, -4) : url;
  }
  
  // Default to localhost:5000 for development
  return 'http://localhost:5000';
};

const API_BASE_URL = getBaseUrl();

export const apiUrl = (path) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const getJson = async (path, options = {}) => {
  try {
    const response = await fetch(apiUrl(path), options);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || 'Request failed');
      err.status = response.status;
      err.data = data;
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

// ============ PAYMENT & CREDITS API ============

// Get available pricing plans
export const fetchPlans = async () => {
  const data = await getJson('/payment/plans');
  return data.plans;
};

// Get user subscription status
export const fetchSubscriptionStatus = async (token) => {
  const data = await getJson('/payment/subscription-status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// Check generation limit
export const checkGenerationLimit = async (token) => {
  const data = await getJson('/credits/check-limit', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// Login function for LoginModal
export const login = async (identifier, password) => {
  return await getJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
};

// Get user data with credits
export const fetchUserCreditsData = async (token) => {
  const data = await getJson('/credits/user-data', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// Get credits balance
export const fetchCreditsBalance = async (token) => {
  const data = await getJson('/credits/balance', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// Create order for purchasing credits
export const createPaymentOrder = async (token, planId) => {
  const data = await getJson('/payment/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ planId })
  });
  return data;
};

// Verify payment after successful transaction
export const verifyPayment = async (token, paymentData) => {
  const data = await getJson('/payment/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(paymentData)
  });
  return data;
};
