import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { apiCall } = useAuth();

  // Load restaurants from API
  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const result = await apiCall('/restaurants');
      if (result.success) {
        setRestaurants(result.data);
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load restaurants on mount
  React.useEffect(() => {
    loadRestaurants();
    
    // Set up periodic refresh to keep data in sync
    const interval = setInterval(loadRestaurants, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this only runs once on mount
  
  // Admin functionality
  const updateRestaurant = (restaurantId, updates) => {
    setRestaurants(prev => prev.map(restaurant => 
      restaurant.id === restaurantId ? { ...restaurant, ...updates } : restaurant
    ));
  };

  const addMenuItem = (restaurantId, menuItem) => {
    // This will be handled by the backend API calls
  };

  const updateMenuItem = (restaurantId, itemId, updates) => {
    // This will be handled by the backend API calls
  };

  const deleteMenuItem = (restaurantId, itemId) => {
    // This will be handled by the backend API calls
  };

  const addToCart = (item, restaurantId) => {
    setCart(prev => [...prev, { ...item, restaurantId, id: Date.now() }]);
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const addBooking = (booking) => {
    setBookings(prev => [...prev, { ...booking, id: Date.now(), status: 'confirmed' }]);
  };

  const updateTableStatus = (restaurantId, tableId, status) => {
    setRestaurants(prev => prev.map(restaurant => {
      if (restaurant.id === restaurantId) {
        return {
          ...restaurant,
          tables: restaurant.tables.map(table => 
            table.id === tableId ? { ...table, status } : table
          )
        };
      }
      return restaurant;
    }));
  };

  const loadMenuItems = async (restaurantId) => {
    try {
      const result = await apiCall(`/restaurants/${restaurantId}/menu`);
      if (result.success) {
        return result.data;
      }
    } catch (error) {
      console.error('Failed to load menu items:', error);
      return [];
    }
  };

  const loadUserOrders = async () => {
    try {
      const result = await apiCall('/orders');
      if (result.success) {
        setOrders(result.data);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadUserBookings = async () => {
    try {
      const result = await apiCall('/bookings');
      if (result.success) {
        setBookings(result.data);
      }
    } catch (error) {
      console.error('Failed to load bookings:', error);
    }
  };

  const value = {
    restaurants,
    isLoading,
    loadRestaurants,
    orders,
    bookings,
    cart,
    updateRestaurant,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addToCart,
    removeFromCart,
    clearCart,
    addBooking,
    updateTableStatus,
    loadMenuItems,
    loadUserOrders,
    loadUserBookings
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};