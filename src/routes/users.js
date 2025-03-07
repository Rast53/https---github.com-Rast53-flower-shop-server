const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const models = require('../models');
const User = models.user;

/**
 * @route GET /users
 * @desc Получить список всех пользователей (только для администраторов)
 * @access Private (Admin)
 */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']]
    });

    // Преобразуем имена пользователей
    const formattedUsers = users.map(user => {
      const userData = user.toJSON();
      userData.name = user.getName ? user.getName() : (userData.username || userData.email);
      
      // Определяем статус пользователя
      userData.status = userData.is_active 
        ? 'active' 
        : 'inactive';
        
      // Добавляем роль пользователя
      userData.role = userData.is_admin ? 'Админ' : 'Пользователь';

      return userData;
    });

    res.json({
      data: formattedUsers,
      error: null
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({
      data: null,
      error: 'Ошибка получения списка пользователей'
    });
  }
});

/**
 * @route GET /users/:id
 * @desc Получить информацию о пользователе по ID (только для администраторов или самого пользователя)
 * @access Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Проверяем права доступа: или сам пользователь, или администратор
    if (req.user.id !== userId && !req.user.is_admin) {
      return res.status(403).json({
        data: null,
        error: 'Недостаточно прав для просмотра данных этого пользователя'
      });
    }
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: 'Пользователь не найден'
      });
    }
    
    const userData = user.toJSON();
    userData.name = user.getName ? user.getName() : (userData.username || userData.email);
    userData.status = userData.is_active ? 'active' : 'inactive';
    
    // Добавляем роль пользователя
    userData.role = userData.is_admin ? 'Админ' : 'Пользователь';
    
    res.json({
      data: userData,
      error: null
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({
      data: null,
      error: 'Ошибка получения информации о пользователе'
    });
  }
});

/**
 * @route PATCH /users/:id/status
 * @desc Изменить статус пользователя (только для администраторов)
 * @access Private (Admin)
 */
router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
      return res.status(400).json({
        data: null,
        error: 'Недопустимый статус. Разрешены: active, inactive, blocked'
      });
    }
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: 'Пользователь не найден'
      });
    }
    
    // Не разрешаем блокировать администраторов
    if (user.is_admin && status === 'blocked') {
      return res.status(400).json({
        data: null,
        error: 'Невозможно заблокировать администратора'
      });
    }
    
    // Обновляем статус пользователя
    user.is_active = status === 'active';
    await user.save();
    
    res.json({
      data: {
        id: user.id,
        status: status
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка изменения статуса пользователя:', error);
    res.status(500).json({
      data: null,
      error: 'Ошибка изменения статуса пользователя'
    });
  }
});

/**
 * @route GET /users/:id/orders
 * @desc Получить заказы пользователя (только для администраторов или самого пользователя)
 * @access Private
 */
router.get('/:id/orders', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { count_only } = req.query;
    
    // Проверяем права доступа: или сам пользователь, или администратор
    if (req.user.id !== userId && !req.user.is_admin) {
      return res.status(403).json({
        data: null,
        error: 'Недостаточно прав для просмотра заказов этого пользователя'
      });
    }
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: 'Пользователь не найден'
      });
    }

    // Если запрошена только статистика
    if (count_only === 'true') {
      const { Order } = models;
      const ordersCount = await Order.count({ where: { user_id: userId } });
      
      // Суммируем общую сумму заказов пользователя
      const totalSpentResult = await Order.sum('total_amount', { 
        where: { 
          user_id: userId,
          status: 'completed' // Учитываем только завершенные заказы
        } 
      });
      
      const totalSpent = totalSpentResult || 0;
      
      return res.json({
        data: {
          pagination: {
            totalItems: ordersCount,
            currentPage: 1,
            totalPages: 1
          },
          totalSpent: totalSpent
        },
        error: null
      });
    }
    
    // Получаем заказы пользователя с пагинацией
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { Order, OrderItem, Flower } = models;
    
    const { count, rows: orders } = await Order.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Flower,
              as: 'flower'
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    res.json({
      data: {
        orders,
        pagination: {
          totalItems: count,
          currentPage: page,
          totalPages: Math.ceil(count / limit)
        }
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка получения заказов пользователя:', error);
    res.status(500).json({
      data: null,
      error: 'Ошибка получения заказов пользователя'
    });
  }
});

module.exports = router; 