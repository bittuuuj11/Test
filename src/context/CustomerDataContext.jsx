import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { apiCache } from '../utils/apiCache';

const CustomerDataContext = createContext();

export const useCustomerData = () => {
  const context = useContext(CustomerDataContext);
  if (!context) {
    throw new Error('useCustomerData must be used within a CustomerDataProvider');
  }
  return context;
};

export const CustomerDataProvider = ({ children }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { apiCall, isAuthenticated, authChecked, token } = useCustomerAuth();
  const loadingRef = useRef(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadStoredData = () => {
      try {
        const storedRestaurants = localStorage.getItem('customer_restaurants');
        const storedOrders = localStorage.getItem('customer_orders');
        const storedBookings = localStorage.getItem('customer_bookings');
        const storedCart = localStorage.getItem('customer_cart');
        
        if (storedRestaurants) {
          setRestaurants(JSON.parse(storedRestaurants));
        }
        if (storedOrders) {
          setOrders(JSON.parse(storedOrders));
        }
        if (storedBookings) {
          setBookings(JSON.parse(storedBookings));
        }
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        }
        
        console.log('📦 Customer data restored from localStorage');
      } catch (error) {
        console.error('Error loading stored customer data:', error);
      }
    };
    
    loadStoredData();
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (restaurants.length > 0) {
      localStorage.setItem('customer_restaurants', JSON.stringify(restaurants));
    }
  }, [restaurants]);

  useEffect(() => {
    if (orders.length > 0) {
      localStorage.setItem('customer_orders', JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
    if (bookings.length > 0) {
      localStorage.setItem('customer_bookings', JSON.stringify(bookings));
    }
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('customer_cart', JSON.stringify(cart));
  }, [cart]);

  // Load restaurants from API with deduplication
  const loadRestaurants = async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const result = await apiCache.dedupe('/restaurants', {}, async () => {
        const response = await fetch('http://localhost:5000/api/restaurants');
        return await response.json();
      });

      if (result && result.success) {
        setRestaurants(result.data);
        setDataLoaded(true);
        console.log('🏪 Customer restaurants loaded from API');
      } else if (result && Array.isArray(result)) {
        setRestaurants(result.data);
        setDataLoaded(true);
      } else if (Array.isArray(result)) {
        setRestaurants(result);
        setDataLoaded(true);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load restaurants from API:', error.message);
      if (restaurants.length === 0) {
        setRestaurants([
          {
            id: 1,
            name: 'The Golden Spoon',
            cuisine: 'Fine Dining',
            rating: 4.8,
            image: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg',
            address: '123 Gourmet Street, Downtown',
            phone: '+1 (555) 123-4567',
            description: 'Exquisite fine dining experience with contemporary cuisine',
            tables: [],
            total_tables: 20,
            available_tables: 12
          },
          {
            id: 2,
            name: 'Sakura Sushi',
            cuisine: 'Japanese',
            rating: 4.6,
            image: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg',
            address: '456 Zen Garden Ave, Midtown',
            phone: '+1 (555) 234-5678',
            description: 'Authentic Japanese cuisine with fresh sushi and sashimi',
            tables: [],
            total_tables: 15,
            available_tables: 8
          },
          {
            id: 3,
            name: "Mama's Italian",
            cuisine: 'Italian',
            rating: 4.7,
            image: 'https://images.pexels.com/photos/315755/pexels-photo-315755.jpeg',
            address: '789 Pasta Lane, Little Italy',
            phone: '+1 (555) 345-6789',
            description: 'Traditional Italian flavors in a cozy family atmosphere',
            tables: [],
            total_tables: 18,
            available_tables: 10
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  // Load restaurants when authentication is ready
  React.useEffect(() => {
    if (authChecked && !dataLoaded) {
      loadRestaurants();
    }
  }, [authChecked]);

  // Set up periodic refresh
  React.useEffect(() => {
    if (!dataLoaded) return;

    const interval = setInterval(() => {
      loadRestaurants();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [dataLoaded]);

  const addToCart = (item, restaurantId) => {
    setCart(prev => [...prev, { ...item, restaurantId, cartItemId: Date.now() }]);
  };

  const removeFromCart = (cartItemId) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
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

  const loadUserOrders = async () => {
    if (!isAuthenticated || !token) return;

    try {
      const result = await apiCache.dedupe('/orders', {}, async () => {
        return await apiCall('/orders');
      });

      if (result && result.success) {
        setOrders(result.data);
        console.log('📋 Customer orders loaded from API');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load customer orders:', error.message);
    }
  };

  const loadUserBookings = async () => {
    if (!isAuthenticated || !token) return;

    try {
      const result = await apiCache.dedupe('/bookings', {}, async () => {
        return await apiCall('/bookings');
      });

      if (result && result.success) {
        setBookings(result.data);
        console.log('📅 Customer bookings loaded from API');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load customer bookings:', error.message);
    }
  };

  const value = {
    restaurants,
    isLoading,
    dataLoaded,
    loadRestaurants,
    orders,
    bookings,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    addBooking,
    updateTableStatus,
    loadUserOrders,
    loadUserBookings
  };

  return (
    <CustomerDataContext.Provider value={value}>
      {children}
    </CustomerDataContext.Provider>
  );
};