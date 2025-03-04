const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');

// Все маршруты требуют двойной проверки
router.use(authMiddleware);
router.use(adminMiddleware);

// Пример защищенного маршрута
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

module.exports = router; 