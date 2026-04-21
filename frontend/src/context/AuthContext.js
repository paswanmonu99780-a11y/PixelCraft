import React, { createContext, useContext, useState, useEffect } from 'react';
import { getJson } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const data = await getJson('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setUser(data.user);
        }
      } catch (error) {
        if (error.status === 401 && isMounted) {
          // Token is invalid, clear auth state and redirect to login
          setToken(null);
          setUser(null);
          // Clear AI Assistant state as well
          localStorage.removeItem('ai-assistant-open');
          localStorage.removeItem('ai-assistant-minimized');
        } else {
          console.warn('User sync failed:', error.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = async (identifier, password, rememberMe = false) => {
    try {
      const data = await getJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });

      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const sendSignupCode = async (identifier) => {
    try {
      return await getJson('/api/auth/send-signup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
    } catch (error) {
      throw error;
    }
  };

  const signup = async ({ username, identifier, password, confirmPassword, code, referralCode }) => {
    try {
      const data = await getJson('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, identifier, password, confirmPassword, code, referralCode }),
      });

      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const sendPasswordResetCode = async (identifier) => {
    try {
      return await getJson('/api/auth/send-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async ({ identifier, code, password, confirmPassword }) => {
    try {
      return await getJson('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code, password, confirmPassword }),
      });
    } catch (error) {
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!token) return null;

    const data = await getJson('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setLoading(false);
    // Reset AI Assistant state
    localStorage.removeItem('ai-assistant-open');
    localStorage.removeItem('ai-assistant-minimized');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        sendSignupCode,
        signup,
        sendPasswordResetCode,
        resetPassword,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
