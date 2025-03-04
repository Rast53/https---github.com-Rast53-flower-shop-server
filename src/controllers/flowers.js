const db = require('../config/db');
const { flower: Flower, category: Category } = require('../models');
const { Op } = require('sequelize');

/**
 * Получение всех цветов с возможностью фильтрации
 */
const getFlowers = async (req, res) => {
  try {
    console.log('Запрос на получение цветов с параметрами:', req.query);
    
    // Формируем условия запроса на основе параметров
    const where = {};
    
    if (req.query.category_id) {
      where.category_id = req.query.category_id;
    }
    
    if (req.query.min_price || req.query.max_price) {
      where.price = {};
      if (req.query.min_price) {
        where.price[Op.gte] = parseFloat(req.query.min_price);
      }
      if (req.query.max_price) {
        where.price[Op.lte] = parseFloat(req.query.max_price);
      }
    }
    
    if (req.query.search) {
      where.name = {
        [Op.iLike]: `%${req.query.search}%`
      };
    }
    
    // Опции сортировки
    let order = [['popularity', 'DESC']]; // По умолчанию сортируем по популярности
    
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price_asc':
          order = [['price', 'ASC']];
          break;
        case 'price_desc':
          order = [['price', 'DESC']];
          break;
        case 'name_asc':
          order = [['name', 'ASC']];
          break;
        case 'newest':
          order = [['created_at', 'DESC']];
          break;
      }
    }
    
    // Логируем доступные атрибуты модели
    const attributes = Object.keys(Flower.rawAttributes);
    console.log('Доступные атрибуты цветов:', attributes);
    
    // Получаем цветы без запроса поля slug
    const flowers = await Flower.findAll({
      where,
      order,
      attributes: ['id', 'name', 'description', 'price', 'stock_quantity', 'image_url', 'popularity', 'category_id', 'is_available', 'created_at', 'updated_at'],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug'] // Оставляем slug для категорий
      }]
    });
    
    res.json({
      data: flowers,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении цветов:', error);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение всех цветов без фильтрации
 */
const getAllFlowers = async (req, res) => {
  try {
    console.log('Запрос на получение всех цветов без фильтрации');
    
    // Получаем все цветы без фильтрации, не запрашивая slug
    const flowers = await Flower.findAll({
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug'] // Оставляем slug для категорий
      }],
      order: [['popularity', 'DESC']]
    });
    
    res.json({
      data: flowers,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении всех цветов:', error);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение цветка по ID
 */
const getFlowerById = async (req, res) => {
  try {
    const flowerId = req.params.id;
    
    // Ищем цветок по ID
    const flower = await Flower.findByPk(flowerId, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }]
    });
    
    if (!flower) {
      return res.status(404).json({
        error: 'Цветок не найден',
        data: null
      });
    }
    
    res.json({
      data: flower,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении цветка:', error);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
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
  getFlowers,
  getAllFlowers,
  getFlowerById,
  createFlower,
  updateFlower,
  deleteFlower
};