const db = require('../config/db');
const { category: Category, flower: Flower } = require('../models');

/**
 * Получение всех категорий
 */
const getCategories = async (req, res) => {
  try {
    console.log('Запрос на получение категорий');
    
    // Логируем доступные атрибуты модели
    const attributes = Object.keys(Category.rawAttributes);
    console.log('Доступные атрибуты категорий:', attributes);
    
    // Получаем все категории с их связанными цветами
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug', 'description', 'image_url', 'created_at', 'updated_at'],
      include: [{
        model: Flower,
        as: 'flowers',
        attributes: ['id', 'name', 'price', 'image_url', 'popularity'] // Вернули popularity
      }]
    });
    
    res.json({
      data: categories,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении категорий:', error);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение категории по ID
 */
const getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Ищем категорию по ID
    const category = await Category.findByPk(categoryId, {
      include: [{
        model: Flower,
        as: 'flowers',
        attributes: ['id', 'name', 'price', 'image_url', 'description', 'popularity', 'stock_quantity']
      }]
    });
    
    if (!category) {
      return res.status(404).json({
        error: 'Категория не найдена',
        data: null
      });
    }
    
    res.json({
      data: category,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении категории:', error);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
  }
};

/**
 * Создание новой категории
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, image_url } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Название категории обязательно' });
    }
    
    // Проверяем, существует ли уже категория с таким именем
    const existCheck = await db.query(
      'SELECT * FROM categories WHERE name = $1',
      [name]
    );
    
    if (existCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Категория с таким названием уже существует' });
    }
    
    const { rows } = await db.query(
      `INSERT INTO categories (name, description, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, image_url]
    );
    
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ message: 'Ошибка при создании категории' });
  }
};

/**
 * Обновление категории
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url } = req.body;
    
    // Сначала проверим, существует ли категория
    const checkResult = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    // Проверяем, не существует ли уже другая категория с таким именем
    if (name) {
      const existCheck = await db.query(
        'SELECT * FROM categories WHERE name = $1 AND id != $2',
        [name, id]
      );
      
      if (existCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Категория с таким названием уже существует' });
      }
    }
    
    const { rows } = await db.query(
      `UPDATE categories 
       SET name = $1, description = $2, image_url = $3
       WHERE id = $4
       RETURNING *`,
      [name, description, image_url, id]
    );
    
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    return res.status(500).json({ message: 'Ошибка при обновлении категории' });
  }
};

/**
 * Удаление категории
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Сначала проверим, существует ли категория
    const checkResult = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    // Проверим, есть ли цветы в этой категории
    const flowersCheck = await db.query('SELECT COUNT(*) FROM flowers WHERE category_id = $1', [id]);
    
    if (parseInt(flowersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Нельзя удалить категорию, содержащую цветы. Сначала удалите все цветы из категории.'
      });
    }
    
    await db.query('DELETE FROM categories WHERE id = $1', [id]);
    
    return res.status(200).json({ message: 'Категория успешно удалена' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({ message: 'Ошибка при удалении категории' });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};