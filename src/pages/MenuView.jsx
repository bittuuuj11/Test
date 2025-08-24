import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ArrowLeft, Plus, Minus, ShoppingCart, Star, Leaf, Heart, Filter, Loader } from 'lucide-react';

const MenuView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cart } = useData();
  const { apiCall } = useAuth();
  const { addNotification } = useNotification();
  
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDietary, setSelectedDietary] = useState('all');
  const [itemQuantities, setItemQuantities] = useState({});

  useEffect(() => {
    if (id) {
      loadRestaurant();
      loadMenu();
    }
  }, [id]);

  const loadRestaurant = async () => {
    setIsLoadingRestaurant(true);
    try {
      const result = await apiCall(`/restaurants/${id}`);
      if (result.success) {
        setRestaurant(result.data);
      }
    } catch (error) {
      addNotification('Failed to load restaurant details', 'error');
      navigate('/dashboard');
    } finally {
      setIsLoadingRestaurant(false);
    }
  };

  const loadMenu = async () => {
    setIsLoadingMenu(true);
    try {
      const result = await apiCall(`/restaurants/${id}/menu`);
      if (result.success) {
        setMenuItems(result.data);
      }
    } catch (error) {
      addNotification('Failed to load menu', 'error');
      setMenuItems([]);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  if (isLoadingRestaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Restaurant not found</h2>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const categories = ['all', ...new Set(menuItems.map(item => item.category))];
  const dietaryOptions = ['all', 'vegetarian', 'gluten-free', 'healthy', 'vegan'];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesDietary = selectedDietary === 'all' || (item.dietary && item.dietary.toLowerCase().includes(selectedDietary.toLowerCase()));
    return matchesCategory && matchesDietary && item.available;
  });

  const updateQuantity = (itemId, change) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + change)
    }));
  };

  const handleAddToCart = (item) => {
    const quantity = itemQuantities[item.id] || 1;
    for (let i = 0; i < quantity; i++) {
      addToCart(item, restaurant.id);
    }
    addNotification(`Added ${quantity}x ${item.name} to cart`, 'success');
    setItemQuantities(prev => ({ ...prev, [item.id]: 0 }));
  };

  const totalCartItems = cart.filter(item => item.restaurantId === parseInt(id)).length;

  const getDietaryBadges = (dietary) => {
    if (!dietary) return [];
    return dietary.toLowerCase().split(',').map(d => d.trim()).filter(d => d);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 space-y-2 sm:space-y-0">
            <Link to="/dashboard" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm md:text-base">Back to Dashboard</span>
            </Link>
            
            {totalCartItems > 0 && (
              <Link
                to={`/restaurant/${id}/preorder`}
                className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all duration-300 text-sm md:text-base"
              >
                <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                <span>Cart ({totalCartItems})</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Restaurant Header */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-slate-900 to-slate-700">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute bottom-4 md:bottom-6 left-0 right-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{restaurant.name}</h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm md:text-base text-white/90">
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-current" />
                <span>{restaurant.rating}</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>{restaurant.cuisine}</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">{restaurant.address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b sticky top-16 md:top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700 font-medium text-sm md:text-base">Categories:</span>
              <div className="flex space-x-2 overflow-x-auto">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category === 'all' ? 'All Categories' : category}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-700 font-medium text-sm md:text-base">Dietary:</span>
              <div className="flex space-x-2 overflow-x-auto">
                {dietaryOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => setSelectedDietary(option)}
                    className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedDietary === option
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option === 'all' ? 'All Options' : option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {isLoadingMenu ? (
          <div className="text-center py-12">
            <Loader className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading menu...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {menuItems.length === 0 ? 'No menu items available' : 'No items found'}
            </h3>
            <p className="text-gray-600 text-sm md:text-base">
              {menuItems.length === 0 
                ? 'The restaurant admin hasn\'t added any menu items yet.' 
                : 'Try adjusting your category or dietary filters'
              }
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 md:hover:-translate-y-2">
                {item.chef_special && (
                  <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center py-2 text-xs md:text-sm font-medium">
                    🌟 Chef's Special
                  </div>
                )}
                
                <div className="relative">
                  <img
                    src={item.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                    alt={item.name}
                    className="w-full h-40 md:h-48 object-cover"
                    onError={(e) => {
                      e.target.src = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
                    }}
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="font-bold text-green-600">${item.price}</span>
                  </div>
                  
                  {getDietaryBadges(item.dietary).length > 0 && (
                    <div className="absolute bottom-4 left-4 flex space-x-2">
                      {getDietaryBadges(item.dietary).map((diet, index) => (
                        <div key={index} className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                          {diet === 'vegetarian' && (
                            <div className="flex items-center space-x-1">
                              <Leaf className="w-3 h-3 text-green-500" />
                              <span className="text-xs font-medium text-green-700">Veg</span>
                            </div>
                          )}
                          {diet === 'gluten-free' && (
                            <span className="text-xs font-bold text-blue-700">GF</span>
                          )}
                          {diet === 'healthy' && (
                            <div className="flex items-center space-x-1">
                              <Heart className="w-3 h-3 text-pink-500" />
                              <span className="text-xs font-medium text-pink-700">Healthy</span>
                            </div>
                          )}
                          {diet === 'vegan' && (
                            <span className="text-xs font-bold text-green-700">Vegan</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-4 md:p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">{item.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4 text-xs md:text-sm leading-relaxed line-clamp-2">{item.description}</p>
                  
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                        disabled={!itemQuantities[item.id]}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 md:w-8 text-center font-semibold text-sm md:text-base">
                        {itemQuantities[item.id] || 0}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={!itemQuantities[item.id]}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
                    >
                      <Plus className="w-3 h-3 md:w-4 md:h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuView;