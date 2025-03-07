const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const flowerController = require('../controllers/flowers');
const uploadImage = require('../middlewares/uploadImage');

// Получение всех цветов с пагинацией и фильтрацией
router.get('/', flowerController.getAllFlowers);

// Заменяем /all на другой метод для получения всех цветов без фильтрации
router.get('/all', flowerController.getFlowers); 

// Получение цветка по ID - убираем authMiddleware
router.get('/:id', flowerController.getFlowerById);

// Маршруты для администраторов с поддержкой загрузки файлов
router.post('/', 
  authMiddleware, 
  adminMiddleware, 
  uploadImage.single('image'), // Обработка загрузки одного изображения
  flowerController.createFlower
);

router.put('/:id', 
  authMiddleware, 
  adminMiddleware, 
  uploadImage.single('image'), // Обработка загрузки одного изображения
  flowerController.updateFlower
);

router.delete('/:id', authMiddleware, adminMiddleware, flowerController.deleteFlower);

module.exports = router;
