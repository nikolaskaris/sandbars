import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('surf_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('surf_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password) {
          const userData = {
            id: Math.random().toString(36).substr(2, 9),
            email: email,
            name: email.split('@')[0],
            createdAt: new Date().toISOString(),
            favorites: [],
          };
          setUser(userData);
          localStorage.setItem('surf_user', JSON.stringify(userData));
          resolve(userData);
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 500);
    });
  };

  const register = async (email, password, name) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password && name) {
          const userData = {
            id: Math.random().toString(36).substr(2, 9),
            email: email,
            name: name,
            createdAt: new Date().toISOString(),
            favorites: [],
          };
          setUser(userData);
          localStorage.setItem('surf_user', JSON.stringify(userData));
          resolve(userData);
        } else {
          reject(new Error('All fields are required'));
        }
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('surf_user');
  };

  const addFavorite = (spot) => {
    const updatedUser = {
      ...user,
      favorites: [...(user.favorites || []), spot],
    };
    setUser(updatedUser);
    localStorage.setItem('surf_user', JSON.stringify(updatedUser));
  };

  const removeFavorite = (spotId) => {
    const updatedUser = {
      ...user,
      favorites: (user.favorites || []).filter((s) => s.id !== spotId),
    };
    setUser(updatedUser);
    localStorage.setItem('surf_user', JSON.stringify(updatedUser));
  };

  const updateFavorite = (spotId, updatedData) => {
    const updatedUser = {
      ...user,
      favorites: (user.favorites || []).map((s) =>
        s.id === spotId ? { ...s, ...updatedData } : s
      ),
    };
    setUser(updatedUser);
    localStorage.setItem('surf_user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    loading,
    addFavorite,
    removeFavorite,
    updateFavorite,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
