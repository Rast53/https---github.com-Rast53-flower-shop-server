const db = require('../config/db');

/**
 * Получение всех цветов с возможностью фильтрации по категории
 */
const getAllFlowers = async (req, res) => {
  try {
    const { category_id } = req.query;
    let query = `
      SELECT f.*, c.name as category_name 
      FROM flowers f
      LEFT JOIN categories c ON f.category_id = c.id
    `;
    const params = [];

    if (category_id) {
      query += ' WHERE f.category_id = $1';
      params.push(category_id);
    }

    query += ' ORDER BY f.created_at DESC';
    
    const { rows } = await db.query(query, params);
    
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error getting flowers:', error);
    return res.status(500).json({ message: 'Ошибка при получении цветов' });
  }
};

/**
 * Получение цветка по ID
 */
const getFlowerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await db.query(
      `SELECT f.*, c.name as category_name 
       FROM flowers f
       LEFT JOIN categories c ON f.category_id = c.id
       WHERE f.id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Цветок не найден' });
    }
    
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error getting flower by ID:', error);
    return res.status(500).json({ message: 'Ошибка при получении цветка' });
  }
};

/**
 * Создание нового цветка
 */
const createFlower = async (req, res) => {
  try {
    const { name, description, price, stock_quantity, image_url, category_id } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ message: 'Название и цена обязательны' });
    }
    
    const { rows } = await db.query(
      `INSERT INTO flowers (name, description, price, stock_quantity, image_url, category_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, price, stock_quantity || 0, image_url, category_id]
    );
    
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating flower:', error);
    return res.status(500).json({ message: 'Ошибка при создании цветка' });
  }
};

/**
 * Обновление цветка
 */
const updateFlower = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock_quantity, image_url, category_id } = req.body;
    
    // Сначала проверим, существует ли цветок
    const checkResult = await db.query('SELECT * FROM flowers WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Цветок не найден' });
    }
    
    const { rows } = await db.query(
      `UPDATE flowers 
       SET name = $1, description = $2, price = $3, stock_quantity = $4, 
           image_url = $5, category_id = $6
       WHERE id = $7
       RETURNING *`,
      [name, description, price, stock_quantity, image_url, category_id, id]
    );
    
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error updating flower:', error);
    return res.status(500).json({ message: 'Ошибка при обновлении цветка' });
  }
};

/**
 * Удаление цветка
 */
const deleteFlower = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Сначала проверим, существует ли цветок
    const checkResult = await db.query('SELECT * FROM flowers WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Цветок не найден' });
    }
    
    await db.query('DELETE FROM flowers WHERE id = $1', [id]);
    
    return res.status(200).json({ message: 'Цветок успешно удален' });
  } catch (error) {
    console.error('Error deleting flower:', error);
    return res.status(500).json({ message: 'Ошибка при удалении цветка' });
  }
};

module.exports = {
  getAllFlowers,
  getFlowerById,
  createFlower,
  updateFlower,
  deleteFlower
};