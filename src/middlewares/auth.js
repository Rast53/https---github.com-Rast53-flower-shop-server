const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware для проверки JWT токена
const authMiddleware = async (req, res, next) => {
  try {
    // Проверяем наличие токена в заголовке
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Не авторизован',
        data: null
      });
    }

    // Извлекаем токен из заголовка
    const token = authHeader.split(' ')[1];
    
    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_change_in_production');
    
    // Находим пользователя
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Не найден пользователь с таким токеном',
        data: null
      });
    }
    
    // Добавляем пользователя к запросу
    req.user = user;
    next();
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    return res.status(401).json({
      error: 'Недействительный токен авторизации',
      data: null
    });
  }
};

// Middleware для проверки прав администратора
const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      error: 'Доступ запрещен. Требуются права администратора',
      data: null
    });
  }
  next();
};

// Добавляем после authMiddleware
const adminCheck = (req, res, next) => {
  if (!req.user.isAdmin) {
    console.warn('Admin access denied for user:', req.user.id);
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware: adminCheck // Переименовываем для ясности
}; 