const jwt = require('jsonwebtoken');
const models = require('../models');
const User = models.user;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_in_production';

/**
 * Middleware для проверки авторизации пользователя
 * Проверяет валидность JWT токена и добавляет информацию о пользователе в request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Требуется авторизация', 
        data: null 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Проверяем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Добавляем отладочную информацию
    console.log('Доступные модели:', Object.keys(models));
    console.log('Ищем пользователя с ID:', decoded.id);
    
    if (!User) {
      console.error('Модель User не определена');
      return res.status(500).json({
        error: 'Внутренняя ошибка сервера: модель User не определена',
        data: null
      });
    }
    
    // Находим пользователя в базе данных
    const user = await User.findByPk(decoded.id);
    
    // Проверяем, существует ли пользователь и активен ли он
    if (!user || !user.is_active) {
      return res.status(401).json({ 
        error: 'Пользователь не найден или заблокирован', 
        data: null 
      });
    }
    
    // Добавляем информацию о пользователе в запрос
    req.user = {
      id: user.id,
      email: user.email,
      name: user.getName ? user.getName() : (user.username || user.email),
      is_admin: user.is_admin,
      telegram_id: user.telegram_id
    };
    
    next();
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    return res.status(401).json({ 
      error: 'Неверный токен авторизации', 
      data: null 
    });
  }
};

/**
 * Middleware для проверки прав администратора
 * Должен использоваться после middleware авторизации
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    console.warn('Admin access denied for user:', req.user ? req.user.id : 'unknown');
    return res.status(403).json({ 
      error: 'Доступ запрещен. Требуются права администратора', 
      data: null 
    });
  }
  
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware
}; 