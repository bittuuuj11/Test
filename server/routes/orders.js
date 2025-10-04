const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const orderValidation = [
    body('restaurantId').isInt({ min: 1 }).withMessage('Valid restaurant ID is required'),
    body('orderType').isIn(['pickup', 'delivery', 'dine-in']).withMessage('Order type must be pickup, delivery, or dine-in'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.menuItemId').isInt({ min: 1 }).withMessage('Valid menu item ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount is required'),
    body('scheduledTime').optional().isISO8601().withMessage('Valid scheduled time is required'),
    body('specialInstructions').optional().isLength({ max: 500 }).withMessage('Special instructions must be less than 500 characters')
];

// POST /api/orders - Create a new order
router.post('/', authenticateToken, authorizeRole(['customer']), orderValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { restaurantId, orderType, items, totalAmount, scheduledTime, specialInstructions } = req.body;
        const userId = req.user.id;

        // Verify restaurant exists and is active
        const restaurant = await db.get(
            'SELECT id, name FROM restaurants WHERE id = ? AND is_active = 1',
            [restaurantId]
        );

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Verify all menu items exist and belong to the restaurant
        const menuItemIds = items.map(item => item.menuItemId);
        const menuItems = await db.all(`
            SELECT id, name, price, available 
            FROM menu_items 
            WHERE id IN (${menuItemIds.map(() => '?').join(',')}) AND restaurant_id = ?
        `, [...menuItemIds, restaurantId]);

        if (menuItems.length !== menuItemIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more menu items not found'
            });
        }

        // Check if all items are available
        const unavailableItems = menuItems.filter(item => !item.available);
        if (unavailableItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Some items are not available: ${unavailableItems.map(item => item.name).join(', ')}`
            });
        }

        // Calculate and verify total amount
        let subtotal = 0;
        const orderItemsData = [];

        for (const orderItem of items) {
            const menuItem = menuItems.find(item => item.id === orderItem.menuItemId);
            const itemTotal = menuItem.price * orderItem.quantity;
            subtotal += itemTotal;

            orderItemsData.push({
                menuItemId: orderItem.menuItemId,
                quantity: orderItem.quantity,
                price: menuItem.price
            });
        }

        // Calculate tax and delivery fees
        const tax = subtotal * 0.08; // 8% tax
        const deliveryFee = orderType === 'delivery' ? 5.99 : 0;
        const calculatedTotal = subtotal + tax + deliveryFee;

        // Allow small floating point differences
        if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: `Total amount mismatch. Expected: ${calculatedTotal.toFixed(2)}, Received: ${totalAmount.toFixed(2)}`
            });
        }

        // Create order
        const orderResult = await db.run(`
            INSERT INTO orders (user_id, restaurant_id, order_type, status, total_amount, scheduled_time, special_instructions)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
        `, [userId, restaurantId, orderType, totalAmount, scheduledTime || null, specialInstructions || null]);

        const orderId = orderResult.id;

        // Insert order items
        for (const item of orderItemsData) {
            await db.run(`
                INSERT INTO order_items (order_id, menu_item_id, quantity, price)
                VALUES (?, ?, ?, ?)
            `, [orderId, item.menuItemId, item.quantity, item.price]);
        }

        // Insert initial status history
        await db.run(`
            INSERT INTO order_status_history (order_id, status, notes)
            VALUES (?, 'pending', 'Order created')
        `, [orderId]);

        console.log(`✅ Order created: Order ID ${orderId} for User ${userId} at ${restaurant.name}`);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId,
                restaurantName: restaurant.name,
                orderType,
                totalAmount,
                status: 'pending',
                estimatedTime: orderType === 'delivery' ? '45-60 minutes' : '20-30 minutes'
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating order'
        });
    }
});

// GET /api/orders - Get user's orders
router.get('/', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const userId = req.user.id;

        const orders = await db.all(`
            SELECT 
                o.id, o.order_type, o.status, o.total_amount, o.scheduled_time, 
                o.special_instructions, o.created_at,
                r.name as restaurant_name, r.address as restaurant_address, r.phone as restaurant_phone
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        `, [userId]);

        // Get order items for each order
        for (const order of orders) {
            const orderItems = await db.all(`
                SELECT 
                    oi.quantity, oi.price,
                    mi.name as item_name, mi.description as item_description
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = ?
            `, [order.id]);
            
            order.items = orderItems;
        }

        res.status(200).json({
            success: true,
            message: 'Orders retrieved successfully',
            data: orders
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching orders'
        });
    }
});

// GET /api/orders/:id - Get specific order details
router.get('/:id', authenticateToken, authorizeRole(['customer']), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const order = await db.get(`
            SELECT 
                o.id, o.order_type, o.status, o.total_amount, o.scheduled_time, 
                o.special_instructions, o.created_at,
                r.name as restaurant_name, r.address as restaurant_address, r.phone as restaurant_phone
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.id = ? AND o.user_id = ?
        `, [id, userId]);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Get order items
        const orderItems = await db.all(`
            SELECT 
                oi.quantity, oi.price,
                mi.name as item_name, mi.description as item_description, mi.image as item_image
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
        `, [id]);

        // Get status history
        const statusHistory = await db.all(`
            SELECT status, notes, created_at
            FROM order_status_history
            WHERE order_id = ?
            ORDER BY created_at ASC
        `, [id]);

        order.items = orderItems;
        order.statusHistory = statusHistory;

        res.status(200).json({
            success: true,
            message: 'Order details retrieved successfully',
            data: order
        });

    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching order details'
        });
    }
});

module.exports = router;