import React, { createContext, useContext, useState, useEffect } from 'react';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

const CustomerAuthContext = createContext();

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};

export const CustomerAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for stored customer authentication on app load
    const checkStoredAuth = () => {
      try {
        const storedUser = localStorage.getItem('customer_user');
        const storedToken = localStorage.getItem('customer_token');
        
        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
            
          // Validate token is not expired
          try {
            const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenPayload.exp && tokenPayload.exp > currentTime && tokenPayload.role === 'customer') {
              setUser(parsedUser);
              setToken(storedToken);
              setIsAuthenticated(true);
              console.log('✅ Customer authentication restored from localStorage');
            } else {
              // Token expired or wrong role, clear storage
              console.log('⚠️ Customer token expired or invalid, clearing auth');
              clearCustomerAuth();
            }
          } catch (tokenError) {
            console.error('Error parsing customer token:', tokenError);
            clearCustomerAuth();
          }
        }
      } catch (error) {
        console.error('Error parsing stored customer data:', error);
        clearCustomerAuth();
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkStoredAuth();
  }, []);

  const clearCustomerAuth = () => {
    localStorage.removeItem('customer_user');
    localStorage.removeItem('customer_token');
  };

  const login = (userData, authToken) => {
    console.log('🔐 Customer logging in:', userData.name);
    
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    
    // Store auth data with customer prefix for isolation
    localStorage.setItem('customer_user', JSON.stringify(userData));
    localStorage.setItem('customer_token', authToken);
  };

  const logout = () => {
    console.log('🚪 Customer logging out');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    clearCustomerAuth();
  };

  // API helper function for customer requests
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
        
        // Only logout on authentication errors for customer
        if (response.status === 401 && data.message && data.message.includes('token')) {
          console.log('🔒 Customer token expired or invalid, logging out');
          logout();
        }
        throw new Error(data.message || `API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Log successful API calls for debugging
      if (!endpoint.includes('/restaurants')) {
        console.log(`✅ Customer API call successful: ${endpoint}`, data.success ? 'Success' : 'Failed');
      }
      
      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('⚠️ Network connection error - backend may not be running');
        throw new Error('Unable to connect to server. Please ensure the backend is running.');
      }
      
      if (!error.message.includes('fetch') && !error.message.includes('Network')) {
        console.error('Customer API call error:', error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    role: 'customer',
    token,
    isAuthenticated,
    isLoading,
    authChecked,
    login,
    logout,
    apiCall
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};