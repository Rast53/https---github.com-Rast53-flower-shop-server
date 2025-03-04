const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const flowerController = require('../controllers/flowers');

// Получение всех цветов
router.get('/', flowerController.getFlowers);

// Заменяем /all на другой метод для получения всех цветов без фильтрации
router.get('/all', flowerController.getFlowers); 

// Получение цветка по ID
router.get('/:id', flowerController.getFlowerById);

// Маршруты администратора
router.post('/', authMiddleware, adminMiddleware, flowerController.createFlower);
router.put('/:id', authMiddleware, adminMiddleware, flowerController.updateFlower);
router.delete('/:id', authMiddleware, adminMiddleware, flowerController.deleteFlower);

module.exports = router;
