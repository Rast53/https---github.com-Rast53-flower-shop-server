const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Эти контроллеры будут созданы позже
const { 
  register,
  login,
  logout,
  getMe,
  updateProfile,
  verifyTelegram,
  checkSession,
  getProfile,
  refreshToken,
  telegramAuth
} = require('../controllers/auth');

// Публичные маршруты аутентификации
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify-telegram', verifyTelegram);

// Маршруты для аутентифицированных пользователей
router.get('/me', getMe);
router.put('/me', authMiddleware, updateProfile);
router.get('/profile', authMiddleware, getProfile);
router.post('/refresh-token', refreshToken);

// Новый маршрут для авторизации через Telegram
router.post('/telegram', telegramAuth);

module.exports = router; 