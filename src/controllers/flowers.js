const db = require('../config/db');
const { flower: Flower, category: Category } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Получение всех цветов с возможностью фильтрации и пагинацией
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
    
    // Проверка наличия
    if (req.query.is_available !== undefined) {
      where.is_available = req.query.is_available === 'true';
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
    
    // Пагинация
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Логируем доступные атрибуты модели
    const attributes = Object.keys(Flower.rawAttributes);
    console.log('Доступные атрибуты цветов:', attributes);
    
    // Получаем общее количество записей для пагинации
    const count = await Flower.count({ where });
    
    // Получаем цветы с учетом пагинации
    const flowers = await Flower.findAll({
      where,
      order,
      limit,
      offset,
      attributes: ['id', 'name', 'description', 'price', 'stock_quantity', 'image_url', 'popularity', 'category_id', 'is_available', 'created_at', 'updated_at'],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }]
    });
    
    // Рассчитываем параметры пагинации
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      data: {
        flowers,
        pagination: {
          total: count,
          totalPages,
          currentPage: page,
          limit
        }
      },
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
    
    // Используем тот же формат ответа, что и в getFlowers
    res.json({
      data: {
        flowers,
        pagination: {
          total: flowers.length,
          totalPages: 1,
          currentPage: 1,
          limit: flowers.length
        }
      },
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
      data: {
        flower
      },
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
 * Сохранение загруженного изображения
 */
const saveImage = async (file) => {
  if (!file) return null;
  
  const uploadDir = path.join(__dirname, '../../uploads/flowers');
  
  // Создаем директорию, если она не существует
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Генерируем уникальное имя файла
  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(uploadDir, fileName);
  
  // Сохраняем файл
  fs.writeFileSync(filePath, file.buffer);
  
  // Возвращаем URL изображения
  return `/uploads/flowers/${fileName}`;
};

/**
 * Создание нового цветка
 */
const createFlower = async (req, res) => {
  try {
    // Получаем данные из тела запроса
    const { 
      name, description, price, stock_quantity, image_url, 
      category_id, is_available 
    } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        error: 'Название и цена обязательны',
        data: null
      });
    }
    
    // Проверяем наличие файла изображения
    let finalImageUrl = image_url;
    
    if (req.file) {
      finalImageUrl = await saveImage(req.file);
    }
    
    // Используем Sequelize для создания цветка
    const flower = await Flower.create({
      name,
      description: description || '',
      price: parseFloat(price),
      stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
      image_url: finalImageUrl,
      category_id: category_id || null,
      is_available: is_available === 'true' || is_available === true,
      popularity: 0
    });
    
    // Загружаем данные категории для ответа
    const flowerWithCategory = await Flower.findByPk(flower.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }]
    });
    
    return res.status(201).json({
      data: {
        flower: flowerWithCategory
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка при создании цветка:', error);
    return res.status(500).json({ 
      error: 'Ошибка при создании цветка: ' + error.message,
      data: null
    });
  }
};

/**
 * Обновление цветка
 */
const updateFlower = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, description, price, stock_quantity, image_url, 
      category_id, is_available 
    } = req.body;
    
    // Проверяем существование цветка
    const existingFlower = await Flower.findByPk(id);
    
    if (!existingFlower) {
      return res.status(404).json({ 
        error: 'Цветок не найден',
        data: null
      });
    }
    
    // Проверяем наличие файла изображения
    let finalImageUrl = image_url || existingFlower.image_url;
    
    if (req.file) {
      finalImageUrl = await saveImage(req.file);
      
      // Удаляем старое изображение, если оно существует и не является внешней ссылкой
      if (existingFlower.image_url && existingFlower.image_url.startsWith('/uploads')) {
        const oldImagePath = path.join(__dirname, '../..', existingFlower.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }
    
    // Обновляем цветок через Sequelize
    await existingFlower.update({
      name: name || existingFlower.name,
      description: description !== undefined ? description : existingFlower.description,
      price: price ? parseFloat(price) : existingFlower.price,
      stock_quantity: stock_quantity !== undefined ? parseInt(stock_quantity) : existingFlower.stock_quantity,
      image_url: finalImageUrl,
      category_id: category_id !== undefined ? category_id : existingFlower.category_id,
      is_available: is_available !== undefined ? (is_available === 'true' || is_available === true) : existingFlower.is_available
    });
    
    // Получаем обновленные данные с категорией
    const updatedFlower = await Flower.findByPk(id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }]
    });
    
    return res.status(200).json({
      data: {
        flower: updatedFlower
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка при обновлении цветка:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обновлении цветка: ' + error.message,
      data: null  
    });
  }
};

/**
 * Удаление цветка
 */
const deleteFlower = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Находим цветок по ID
    const flower = await Flower.findByPk(id);
    
    if (!flower) {
      return res.status(404).json({ 
        error: 'Цветок не найден',
        data: null
      });
    }
    
    // Удаляем изображение, если оно существует и находится в локальном хранилище
    if (flower.image_url && flower.image_url.startsWith('/uploads')) {
      const imagePath = path.join(__dirname, '../..', flower.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Удаляем цветок
    await flower.destroy();
    
    return res.status(200).json({
      data: {
        success: true,
        message: 'Цветок успешно удален'
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка при удалении цветка:', error);
    return res.status(500).json({ 
      error: 'Ошибка при удалении цветка: ' + error.message,
      data: null
    });
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