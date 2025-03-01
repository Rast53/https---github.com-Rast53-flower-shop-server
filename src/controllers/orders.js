const db = require('../config/db');

/**
 * Получение всех заказов (только для администраторов)
 */
const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE o.status = $1';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';
    
    const { rows } = await db.query(query, params);
    
    // Для каждого заказа получаем все его позиции
    const ordersWithItems = await Promise.all(
      rows.map(async (order) => {
        const itemsResult = await db.query(
          `SELECT oi.*, f.name as flower_name, f.image_url as flower_image
           FROM order_items oi
           LEFT JOIN flowers f ON oi.flower_id = f.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        
        return {
          ...order,
          items: itemsResult.rows
        };
      })
    );
    
    return res.status(200).json(ordersWithItems);
  } catch (error) {
    console.error('Error getting orders:', error);
    return res.status(500).json({ message: 'Ошибка при получении заказов' });
  }
};

/**
 * Получение заказа по ID (только для администраторов)
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await db.query(
      `SELECT o.*, u.name as user_name, u.email as user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }
    
    // Получаем все позиции заказа
    const itemsResult = await db.query(
      `SELECT oi.*, f.name as flower_name, f.image_url as flower_image
       FROM order_items oi
       LEFT JOIN flowers f ON oi.flower_id = f.id
       WHERE oi.order_id = $1`,
      [id]
    );
    
    const result = {
      ...rows[0],
      items: itemsResult.rows
    };
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting order by ID:', error);
    return res.status(500).json({ message: 'Ошибка при получении заказа' });
  }
};

/**
 * Получение заказов пользователя (для аутентифицированных пользователей)
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { rows } = await db.query(
      `SELECT * FROM orders 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // Для каждого заказа получаем все его позиции
    const ordersWithItems = await Promise.all(
      rows.map(async (order) => {
        const itemsResult = await db.query(
          `SELECT oi.*, f.name as flower_name, f.image_url as flower_image
           FROM order_items oi
           LEFT JOIN flowers f ON oi.flower_id = f.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        
        return {
          ...order,
          items: itemsResult.rows
        };
      })
    );
    
    return res.status(200).json(ordersWithItems);
  } catch (error) {
    console.error('Error getting user orders:', error);
    return res.status(500).json({ message: 'Ошибка при получении заказов пользователя' });
  }
};

/**
 * Создание нового заказа
 */
const createOrder = async (req, res) => {
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
        message: 'Имя, телефон, адрес и позиции заказа обязательны'
      });
    }
    
    // Проверяем наличие и стоимость цветов
    const flowerIds = items.map(item => item.flower_id);
    const { rows: flowers } = await db.query(
      `SELECT id, price, stock_quantity, name FROM flowers 
       WHERE id = ANY($1::int[])`,
      [flowerIds]
    );
    
    // Создаем словарь цветов по id для быстрого доступа
    const flowersMap = {};
    flowers.forEach(flower => {
      flowersMap[flower.id] = flower;
    });
    
    // Проверяем, все ли цветы существуют и достаточно ли их в наличии
    for (const item of items) {
      const flower = flowersMap[item.flower_id];
      
      if (!flower) {
        return res.status(400).json({ 
          message: `Цветок с ID ${item.flower_id} не найден`
        });
      }
      
      if (flower.stock_quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Недостаточное количество цветов "${flower.name}" в наличии. Доступно: ${flower.stock_quantity}`
        });
      }
    }
    
    // Рассчитываем общую стоимость заказа
    let total_amount = 0;
    items.forEach(item => {
      const flower = flowersMap[item.flower_id];
      total_amount += flower.price * item.quantity;
    });
    
    // Начинаем транзакцию
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Создаем заказ
      const orderResult = await client.query(
        `INSERT INTO orders (
          user_id, customer_name, customer_phone, customer_address, 
          total_amount, payment_method, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          user_id, 
          customer_name, 
          customer_phone, 
          customer_address, 
          total_amount, 
          payment_method || 'cash', 
          'pending'
        ]
      );
      
      const order = orderResult.rows[0];
      
      // Добавляем позиции заказа
      for (const item of items) {
        const flower = flowersMap[item.flower_id];
        
        await client.query(
          `INSERT INTO order_items (
            order_id, flower_id, quantity, price_per_unit
          )
          VALUES ($1, $2, $3, $4)`,
          [order.id, item.flower_id, item.quantity, flower.price]
        );
        
        // Уменьшаем количество цветов в наличии
        await client.query(
          `UPDATE flowers 
           SET stock_quantity = stock_quantity - $1
           WHERE id = $2`,
          [item.quantity, item.flower_id]
        );
      }
      
      await client.query('COMMIT');
      
      // Получаем полные данные заказа для ответа
      const completeOrder = await getOrderById(
        { params: { id: order.id } },
        { status: () => ({ json: data => data }) }
      );
      
      return res.status(201).json(completeOrder);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ message: 'Ошибка при создании заказа' });
  }
};

/**
 * Обновление статуса заказа (только для администраторов)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Проверяем валидность статуса
    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Недопустимый статус. Доступные статусы: ${validStatuses.join(', ')}`
      });
    }
    
    // Проверяем существование заказа
    const checkResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }
    
    // Если заказ отменяется, возвращаем цветы в наличие
    if (status === 'cancelled' && checkResult.rows[0].status !== 'cancelled') {
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
        
        // Обновляем статус заказа
        const { rows } = await client.query(
          `UPDATE orders 
           SET status = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [status, id]
        );
        
        await client.query('COMMIT');
        
        return res.status(200).json(rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Простое обновление статуса
      const { rows } = await db.query(
        `UPDATE orders 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );
      
      return res.status(200).json(rows[0]);
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ message: 'Ошибка при обновлении статуса заказа' });
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

module.exports = {
  getAllOrders,
  getOrderById,
  getUserOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder
};