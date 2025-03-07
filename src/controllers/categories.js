const { category: Category, flower: Flower } = require('../models');
const { Op } = require('sequelize');

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
    const { name, slug, description, image_url } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        error: 'Название категории обязательно',
        data: null 
      });
    }
    
    // Проверяем, существует ли уже категория с таким именем
    const existingCategory = await Category.findOne({ 
      where: { name }
    });
    
    if (existingCategory) {
      return res.status(400).json({ 
        error: 'Категория с таким названием уже существует',
        data: null 
      });
    }
    
    // Проверяем, существует ли уже категория с таким slug
    if (slug) {
      const existingSlug = await Category.findOne({ 
        where: { slug } 
      });
      
      if (existingSlug) {
        return res.status(400).json({ 
          error: 'Категория с таким URL (slug) уже существует',
          data: null 
        });
      }
    }
    
    // Создаем новую категорию
    const newCategory = await Category.create({
      name,
      slug: slug || null,
      description: description || null,
      image_url: image_url || null,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return res.status(201).json({
      data: newCategory,
      error: null
    });
  } catch (error) {
    console.error('Ошибка создания категории:', error);
    return res.status(500).json({ 
      error: 'Ошибка при создании категории: ' + error.message,
      data: null 
    });
  }
};

/**
 * Обновление категории
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url } = req.body;
    
    // Сначала проверим, существует ли категория
    const existingCategory = await Category.findByPk(id);
    
    if (!existingCategory) {
      return res.status(404).json({ 
        error: 'Категория не найдена',
        data: null 
      });
    }
    
    // Проверяем, не существует ли уже другая категория с таким именем
    if (name && name !== existingCategory.name) {
      const nameCheck = await Category.findOne({
        where: { 
          name,
          id: { [Op.ne]: id }
        }
      });
      
      if (nameCheck) {
        return res.status(400).json({ 
          error: 'Категория с таким названием уже существует',
          data: null
        });
      }
    }
    
    // Проверяем, не существует ли уже другая категория с таким slug
    if (slug && slug !== existingCategory.slug) {
      const slugCheck = await Category.findOne({
        where: { 
          slug,
          id: { [Op.ne]: id }
        }
      });
      
      if (slugCheck) {
        return res.status(400).json({ 
          error: 'Категория с таким URL (slug) уже существует',
          data: null
        });
      }
    }
    
    // Обновляем категорию
    await existingCategory.update({
      name: name || existingCategory.name,
      slug: slug || existingCategory.slug,
      description: description !== undefined ? description : existingCategory.description,
      image_url: image_url !== undefined ? image_url : existingCategory.image_url,
      updated_at: new Date()
    });
    
    return res.status(200).json({
      data: existingCategory,
      error: null
    });
  } catch (error) {
    console.error('Ошибка обновления категории:', error);
    return res.status(500).json({
      error: 'Ошибка при обновлении категории: ' + error.message,
      data: null
    });
  }
};

/**
 * Удаление категории
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Сначала проверим, существует ли категория
    const existingCategory = await Category.findByPk(id);
    
    if (!existingCategory) {
      return res.status(404).json({ 
        error: 'Категория не найдена',
        data: null
      });
    }
    
    // Проверим, есть ли цветы в этой категории
    const flowersCount = await Flower.count({ where: { category_id: id } });
    
    if (flowersCount > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить категорию, содержащую цветы. Сначала удалите все цветы из категории.',
        data: null
      });
    }
    
    // Удаляем категорию
    await existingCategory.destroy();
    
    return res.status(200).json({ 
      data: { message: 'Категория успешно удалена' },
      error: null
    });
  } catch (error) {
    console.error('Ошибка удаления категории:', error);
    return res.status(500).json({ 
      error: 'Ошибка при удалении категории: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};