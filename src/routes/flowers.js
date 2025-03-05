const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const flowerController = require('../controllers/flowers');
const multer = require('multer');

// Настройка multer для обработки загрузки файлов
const storage = multer.memoryStorage(); // Хранение в памяти для последующей обработки
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Ограничение размера файла (5MB)
  },
  fileFilter: (req, file, cb) => {
    // Проверка типа файла
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый формат файла. Разрешены только изображения.'), false);
    }
  }
});

// Получение всех цветов с пагинацией и фильтрацией
router.get('/', flowerController.getFlowers);

// Заменяем /all на другой метод для получения всех цветов без фильтрации
router.get('/all', flowerController.getFlowers); 

// Получение цветка по ID
router.get('/:id', flowerController.getFlowerById);

// Маршруты для администраторов с поддержкой загрузки файлов
router.post('/', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('image'), // Обработка загрузки одного изображения
  flowerController.createFlower
);

router.put('/:id', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('image'), // Обработка загрузки одного изображения
  flowerController.updateFlower
);

router.delete('/:id', authMiddleware, adminMiddleware, flowerController.deleteFlower);

module.exports = router;
