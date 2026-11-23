import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user session exists via HttpOnly cookie
    api.getMe()
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Unauthenticated - normal on first load
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const register = async (name, email, password, role = 'user') => {
    setError(null);
    try {
      const data = await api.register(name, email, password, role);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
    }
  };

  // 1-Click Demo accounts for rapid testing
  const quickDemoLogin = async (role = 'admin') => {
    const email = role === 'admin' ? 'admin@enterprise.local' : 'developer@enterprise.local';
    const password = 'Password123!';
    const name = role === 'admin' ? 'Admin Operator' : 'Lead Developer';

    try {
      // Try login first
      await login(email, password);
    } catch (e) {
      // If user doesn't exist, create it
      await register(name, email, password, role);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        quickDemoLogin,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

