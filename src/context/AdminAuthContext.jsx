import React, { createContext, useContext, useState, useEffect } from 'react';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for stored admin authentication on app load
    const checkStoredAuth = () => {
      try {
        const storedUser = localStorage.getItem('admin_user');
        const storedToken = localStorage.getItem('admin_token');
        
        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
            
          // Validate token is not expired
          try {
            const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenPayload.exp && tokenPayload.exp > currentTime && tokenPayload.role === 'admin') {
              setUser(parsedUser);
              setToken(storedToken);
              setIsAuthenticated(true);
              console.log('✅ Admin authentication restored from localStorage');
            } else {
              // Token expired or wrong role, clear storage
              console.log('⚠️ Admin token expired or invalid, clearing auth');
              clearAdminAuth();
            }
          } catch (tokenError) {
            console.error('Error parsing admin token:', tokenError);
            clearAdminAuth();
          }
        }
      } catch (error) {
        console.error('Error parsing stored admin data:', error);
        clearAdminAuth();
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkStoredAuth();
  }, []);

  const clearAdminAuth = () => {
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
  };

  const login = (userData, authToken) => {
    console.log('🔐 Admin logging in:', userData.name);
    
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    
    // Store auth data with admin prefix for isolation
    localStorage.setItem('admin_user', JSON.stringify(userData));
    localStorage.setItem('admin_token', authToken);
  };

  const logout = () => {
    console.log('🚪 Admin logging out');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    clearAdminAuth();
  };

  // API helper function for admin requests
  const apiCall = async (endpoint, options = {}) => {
    setIsLoading(true);
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object' && !options.isFormData) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Network error occurred' }));
        
        // Only logout on authentication errors for admin
        if (response.status === 401 && data.message && data.message.includes('token')) {
          console.log('🔒 Admin token expired or invalid, logging out');
          logout();
        }
        throw new Error(data.message || `API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Log successful API calls for debugging
      if (endpoint.includes('/admin/')) {
        console.log(`✅ Admin API call successful: ${endpoint}`, data.success ? 'Success' : 'Failed');
      }
      
      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('⚠️ Network connection error - backend may not be running');
        throw new Error('Unable to connect to server. Please ensure the backend is running.');
      }
      
      if (!error.message.includes('fetch') && !error.message.includes('Network')) {
        console.error('Admin API call error:', error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    role: 'admin',
    token,
    isAuthenticated,
    isLoading,
    authChecked,
    login,
    logout,
    apiCall
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};