const { order: Order, user: User, orderitem: OrderItem, flower: Flower, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Получение всех заказов (только для администраторов)
 */
const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Сопоставление текстовых статусов с status_id
    const statusMapping = {
      'new': 1,
      'processing': 2,
      'shipped': 3,
      'delivered': 4,
      'cancelled': 5
    };
    
    // Создаем условия запроса
    const where = {};
    if (status && statusMapping[status]) {
      where.status_id = statusMapping[status];
    }
    
    // Получаем все заказы с включением связанных моделей
    const orders = await Order.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'telegram_id']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Flower,
              as: 'flower',
              attributes: ['id', 'name', 'price', 'image_url']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Обратное сопоставление для ответа
    const reverseStatusMapping = {
      1: 'new',
      2: 'processing',
      3: 'shipped',
      4: 'delivered',
      5: 'cancelled'
    };
    
    // Форматируем данные для ответа
    const formattedOrders = orders.map(order => {
      const orderData = order.toJSON();
      
      // Добавляем информацию о пользователе в удобном формате
      if (orderData.user) {
        orderData.user_name = orderData.user.first_name && orderData.user.last_name 
          ? `${orderData.user.first_name} ${orderData.user.last_name}` 
          : orderData.user.email;
        orderData.user_email = orderData.user.email;
        orderData.user_phone = orderData.user.phone;
        orderData.telegram_user_id = orderData.user.telegram_id;
      }
      
      // Добавляем текстовый статус
      orderData.status = reverseStatusMapping[orderData.status_id] || 'unknown';
      
      return orderData;
    });
    
    return res.status(200).json({
      data: formattedOrders,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении заказов:', error);
    return res.status(500).json({ 
      error: 'Ошибка при получении заказов: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение заказа по ID (только для администраторов)
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ищем заказ с включением связанных моделей
    const order = await Order.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'telegram_id']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Flower,
              as: 'flower',
              attributes: ['id', 'name', 'price', 'image_url']
            }
          ]
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ 
        error: 'Заказ не найден',
        data: null 
      });
    }
    
    // Форматируем данные для ответа
    const orderData = order.toJSON();
    
    // Добавляем информацию о пользователе в удобном формате
    if (orderData.user) {
      orderData.user_name = orderData.user.first_name && orderData.user.last_name 
        ? `${orderData.user.first_name} ${orderData.user.last_name}` 
        : orderData.user.email;
      orderData.user_email = orderData.user.email;
      orderData.user_phone = orderData.user.phone;
      orderData.telegram_user_id = orderData.user.telegram_id;
    }
    
    // Сопоставление status_id с текстовыми значениями
    const statusMapping = {
      1: 'new',
      2: 'processing',
      3: 'shipped',
      4: 'delivered',
      5: 'cancelled'
    };
    
    // Добавляем текстовый статус
    orderData.status = statusMapping[orderData.status_id] || 'unknown';
    
    return res.status(200).json({
      data: orderData,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении заказа:', error);
    return res.status(500).json({ 
      error: 'Ошибка при получении заказа: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение заказов пользователя (для аутентифицированных пользователей)
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем заказы пользователя с включением позиций заказа
    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Flower,
              as: 'flower',
              attributes: ['id', 'name', 'price', 'image_url']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Форматируем ответ
    const formattedOrders = orders.map(order => {
      const orderData = order.toJSON();
      
      // Добавляем текстовый статус
      const statusMapping = {
        1: 'new',
        2: 'processing',
        3: 'shipped',
        4: 'delivered',
        5: 'cancelled'
      };
      orderData.status = statusMapping[orderData.status_id] || 'unknown';
      
      return orderData;
    });
    
    return res.status(200).json({
      data: formattedOrders,
      error: null
    });
  } catch (error) {
    console.error('Ошибка при получении заказов пользователя:', error);
    return res.status(500).json({ 
      error: 'Ошибка при получении заказов пользователя: ' + error.message,
      data: null
    });
  }
};

/**
 * Создание нового заказа
 */
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      customer_name, 
      customer_phone, 
      customer_address, 
      payment_method,
      items 
    } = req.body;
    
    let user_id = null;
    if (req.user) {
      user_id = req.user.id;
    }
    
    // Проверяем обязательные поля
    if (!customer_name || !customer_phone || !customer_address || !items || !items.length) {
      return res.status(400).json({ 
        error: 'Имя, телефон, адрес и позиции заказа обязательны',
        data: null
      });
    }
    
    // Получаем все цветы из запроса
    // В items ожидаются объекты с полями flower_id, но в БД они будут сохранены как product_id
    const flowerIds = items.map(item => item.flower_id);
    const flowers = await Flower.findAll({
      where: {
        id: {
          [Op.in]: flowerIds
        }
      }
    });
    
    // Создаем словарь для быстрого доступа к цветам
    const flowersMap = {};
    flowers.forEach(flower => {
      flowersMap[flower.id] = flower;
    });
    
    // Проверяем наличие всех цветов в БД
    const missingFlowerIds = flowerIds.filter(id => !flowersMap[id]);
    if (missingFlowerIds.length > 0) {
      return res.status(400).json({
        error: `Цветы с ID ${missingFlowerIds.join(', ')} не найдены`,
        data: null
      });
    }
    
    // Проверяем доступность цветов и их количество
    const unavailableFlowers = [];
    const insufficientStockFlowers = [];
    
    for (const item of items) {
      const flower = flowersMap[item.flower_id];
      
      if (!flower.is_available) {
        unavailableFlowers.push(item.flower_id);
      }
      
      if (flower.stock_quantity < item.quantity) {
        insufficientStockFlowers.push({
          id: item.flower_id,
          name: flower.name,
          requested: item.quantity,
          available: flower.stock_quantity
        });
      }
    }
    
    if (unavailableFlowers.length > 0) {
      return res.status(400).json({
        error: `Цветы с ID ${unavailableFlowers.join(', ')} недоступны для покупки`,
        data: null
      });
    }
    
    if (insufficientStockFlowers.length > 0) {
      return res.status(400).json({
        error: 'Недостаточное количество цветов в наличии',
        data: {
          items: insufficientStockFlowers
        }
      });
    }
    
    // Рассчитываем общую стоимость заказа
    let totalAmount = 0;
    for (const item of items) {
      const flower = flowersMap[item.flower_id];
      totalAmount += parseFloat(flower.price) * item.quantity;
    }
    
    try {
      // Создаем заказ
      const order = await Order.create({
        user_id,
        contact_name: customer_name,     // Используем правильные имена полей
        contact_phone: customer_phone,   // Используем правильные имена полей
        shipping_address: customer_address,
        total_amount: totalAmount,       // Используем правильное имя поля
        // Удаляем поля, которых нет в БД
        // payment_method: payment_method || 'cash',
        status_id: 1, // 'new'
        // payment_status: 'pending',
        notes: req.body.notes || '',
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });
      
      // Добавляем позиции заказа
      for (const item of items) {
        const flower = flowersMap[item.flower_id];
        const unitPrice = parseFloat(flower.price);
        const totalItemPrice = unitPrice * item.quantity;
        
        await OrderItem.create({
          order_id: order.id,
          product_id: item.flower_id, // Используем product_id вместо flower_id
          quantity: item.quantity,
          unit_price: unitPrice,       // Используем unit_price вместо price
          total_price: totalItemPrice  // Добавляем total_price
        }, { transaction });
        
        // Уменьшаем количество цветов в наличии
        await Flower.update(
          { stock_quantity: flower.stock_quantity - item.quantity },
          { 
            where: { id: item.flower_id },
            transaction
          }
        );
      }
      
      await transaction.commit();
      
      // Получаем полные данные заказа с вложенными элементами
      const completeOrder = await Order.findByPk(order.id, {
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
        ]
      });
      
      // Форматируем ответ
      const orderData = completeOrder.toJSON();
      
      // Добавляем текстовый статус
      const statusMapping = {
        1: 'new',
        2: 'processing',
        3: 'shipped',
        4: 'delivered',
        5: 'cancelled'
      };
      orderData.status = statusMapping[orderData.status_id] || 'unknown';
      
      return res.status(201).json({
        data: orderData,
        error: null
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при создании заказа:', error);
    return res.status(500).json({ 
      error: 'Ошибка при создании заказа: ' + error.message,
      data: null
    });
  }
};

/**
 * Обновление статуса заказа (только для администраторов)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Сопоставление текстовых статусов с status_id
    const statusMapping = {
      'new': 1,
      'processing': 2,
      'shipped': 3,
      'delivered': 4,
      'cancelled': 5
    };
    
    // Проверяем валидность статуса
    const validStatuses = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Неверный статус. Допустимые значения: ${validStatuses.join(', ')}`,
        data: null
      });
    }
    
    // Преобразуем текстовый статус в status_id
    const status_id = statusMapping[status];
    
    // Находим заказ
    const order = await Order.findByPk(id);
    
    if (!order) {
      return res.status(404).json({ 
        error: 'Заказ не найден',
        data: null 
      });
    }
    
    // Обновляем статус
    await order.update({ 
      status_id,
      updated_at: new Date()
    });
    
    // Обратное сопоставление для ответа
    const reverseStatusMapping = {
      1: 'new',
      2: 'processing',
      3: 'shipped',
      4: 'delivered',
      5: 'cancelled'
    };
    
    return res.status(200).json({
      data: {
        id: order.id,
        status: reverseStatusMapping[order.status_id] || 'unknown',
        updated_at: order.updated_at
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка при обновлении статуса заказа:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обновлении статуса заказа: ' + error.message,
      data: null
    });
  }
};

/**
 * Удаление заказа (только для администраторов)
 */
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем существование заказа
    const checkResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }
    
    // Если заказ не отменён, то отменяем его (возвращаем цветы в наличие)
    if (checkResult.rows[0].status !== 'cancelled') {
      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Получаем позиции заказа
        const itemsResult = await client.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [id]
        );
        
        // Возвращаем цветы в наличие
        for (const item of itemsResult.rows) {
          await client.query(
            `UPDATE flowers 
             SET stock_quantity = stock_quantity + $1
             WHERE id = $2`,
            [item.quantity, item.flower_id]
          );
        }
        
        // Удаляем все позиции заказа
        await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
        
        // Удаляем заказ
        await client.query('DELETE FROM orders WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        
        return res.status(200).json({ message: 'Заказ успешно удален' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Заказ уже отменён, просто удаляем его
      await db.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      await db.query('DELETE FROM orders WHERE id = $1', [id]);
      
      return res.status(200).json({ message: 'Заказ успешно удален' });
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ message: 'Ошибка при удалении заказа' });
  }
};

/**
 * Получение заказов пользователя по Telegram ID
 * @route GET /api/orders/telegram/:telegramId
 * @access Public
 */
const getOrdersByTelegramId = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    if (!telegramId) {
      return res.status(400).json({
        success: false,
        message: 'Telegram ID обязателен'
      });
    }
    
    // Находим пользователя по Telegram ID
    const user = await User.findOne({
      where: { 
        telegram_id: telegramId.toString() 
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь с таким Telegram ID не найден'
      });
    }
    
    // Получаем заказы пользователя
    const orders = await Order.findAll({
      where: { user_id: user.id },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Flower,
              as: 'flower',
              attributes: ['id', 'name', 'price', 'image_url']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Преобразуем заказы для ответа
    const formattedOrders = orders.map(order => {
      const orderData = order.toJSON();
      
      // Добавляем текстовое описание статуса
      const statusMapping = {
        1: 'Новый',
        2: 'В обработке',
        3: 'Отправлен',
        4: 'Доставлен',
        5: 'Отменен'
      };
      
      orderData.status_text = statusMapping[orderData.status_id] || 'Неизвестно';
      
      // Рассчитываем общее количество товаров
      orderData.total_items = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
      
      return orderData;
    });
    
    return res.status(200).json({
      success: true,
      orders: formattedOrders,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        name: user.getName ? user.getName() : (user.first_name + ' ' + (user.last_name || '')).trim()
      }
    });
  } catch (error) {
    console.error('Ошибка при получении заказов по Telegram ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении заказов пользователя'
    });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  getUserOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrdersByTelegramId
};