const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');

// Эти контроллеры будут созданы позже
const { 
  register,
  login,
  getMe,
  updateProfile,
  verifyTelegram
} = require('../controllers/auth');

// Публичные маршруты аутентификации
router.post('/register', register);
router.post('/login', login);
router.post('/verify-telegram', verifyTelegram);

// Маршруты для аутентифицированных пользователей
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateProfile);

module.exports = router; 