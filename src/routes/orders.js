const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

// Эти контроллеры будут созданы позже
const { 
  getAllOrders,
  getOrderById,
  getUserOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder 
} = require('../controllers/orders');

// Публичные маршруты для создания заказов
router.post('/', createOrder);

// Маршруты для аутентифицированных пользователей
router.get('/user', authMiddleware, getUserOrders);

// Маршруты только для администраторов
router.get('/', authMiddleware, adminMiddleware, getAllOrders);
router.get('/:id', authMiddleware, adminMiddleware, getOrderById);
router.put('/:id/status', authMiddleware, adminMiddleware, updateOrderStatus);
router.delete('/:id', authMiddleware, adminMiddleware, deleteOrder);

module.exports = router; 