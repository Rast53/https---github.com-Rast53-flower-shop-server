const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Middleware для проверки JWT токена
const authMiddleware = (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Не авторизован, требуется токен' });
    }

    const token = authHeader.split(' ')[1];

    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Не авторизован, неверный токен' });
  }
};

// Middleware для проверки прав администратора
const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Проверяем, является ли пользователь администратором
    const { rows } = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(403).json({ message: 'Доступ запрещен, требуются права администратора' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware
}; 