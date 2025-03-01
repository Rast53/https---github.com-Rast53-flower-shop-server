const db = require('../config/db');

/**
 * Получение всех категорий
 */
const getAllCategories = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );
    
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error getting categories:', error);
    return res.status(500).json({ message: 'Ошибка при получении категорий' });
  }
};

/**
 * Получение категории по ID
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await db.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    // Получаем также все цветы в этой категории
    const flowersResult = await db.query(
      'SELECT * FROM flowers WHERE category_id = $1 ORDER BY name ASC',
      [id]
    );
    
    const result = {
      ...rows[0],
      flowers: flowersResult.rows
    };
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting category by ID:', error);
    return res.status(500).json({ message: 'Ошибка при получении категории' });
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
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};