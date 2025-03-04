const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const categoryController = require('../controllers/categories');
const { Category } = require('../models');

// Получение всех категорий
router.get('/', categoryController.getCategories);

// Получение категории по ID
router.get('/:id', categoryController.getCategoryById);

router.post('/', authMiddleware, adminMiddleware, categoryController.createCategory);
router.put('/:id', authMiddleware, adminMiddleware, categoryController.updateCategory);
router.delete('/:id', authMiddleware, adminMiddleware, categoryController.deleteCategory);

module.exports = router;
