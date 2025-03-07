const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const { getDashboardStats } = require('../controllers/admin');

// Все маршруты требуют двойной проверки
router.use(authMiddleware);
router.use(adminMiddleware);

// Пример защищенного маршрута
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

// Маршрут для получения статистики дашборда
router.get('/dashboard/stats', getDashboardStats);

module.exports = router; 