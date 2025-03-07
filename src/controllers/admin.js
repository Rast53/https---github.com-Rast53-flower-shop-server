const { 
  user: User, 
  order: Order, 
  flower: Flower, 
  category: Category,
  orderitem: OrderItem,
  sequelize
} = require('../models');
const { Op, Sequelize } = require('sequelize');

/**
 * Получение статистики для админского дашборда
 */
const getDashboardStats = async (req, res) => {
  try {
    // Получаем базовую статистику
    const [
      totalOrders,
      totalUsers,
      totalProducts,
      totalCategories,
      newOrders
    ] = await Promise.all([
      // Общее количество заказов
      Order.count(),
      
      // Общее количество пользователей
      User.count(),
      
      // Общее количество товаров
      Flower.count(),
      
      // Общее количество категорий
      Category.count(),
      
      // Количество новых (необработанных) заказов
      Order.count({
        where: {
          status_id: 1  // Предполагаем, что 1 соответствует 'new'
        }
      })
    ]);
    
    // Получаем последние 5 заказов
    const recentOrders = await Order.findAll({
      attributes: [
        'id', 
        'user_id', 
        'status_id', 
        'total_amount', // Используем правильное имя поля
        'shipping_address',
        'contact_phone', // Добавляем новые поля
        'contact_name',
        'notes',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    // Популярные товары (по количеству продаж)
    const popularProducts = await OrderItem.findAll({
      attributes: [
        'product_id',
        [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_sold']
      ],
      include: [
        {
          model: Flower,
          as: 'flower',
          attributes: ['id', 'name', 'price', 'image_url']
        }
      ],
      group: ['product_id', 'flower.id'],
      order: [[Sequelize.literal('total_sold'), 'DESC']],
      limit: 5
    });
    
    // Доход за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlyRevenue = await Order.sum('total_amount', {
      where: {
        status_id: {
          [Op.ne]: 5
        },
        created_at: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });
    
    // Общий доход
    const totalRevenue = await Order.sum('total_amount', {
      where: {
        status_id: {
          [Op.ne]: 5
        }
      }
    });
    
    // Форматируем данные последних заказов
    const formattedRecentOrders = recentOrders.map(order => {
      const orderData = order.toJSON();
      const statusMapping = {
        1: 'new',
        2: 'processing',
        3: 'shipped',
        4: 'delivered',
        5: 'cancelled'
      };
      const status = statusMapping[orderData.status_id] || 'unknown';
      
      return {
        id: orderData.id,
        date: orderData.created_at,
        status: status,
        total: parseFloat(orderData.total_amount || 0),
        customer: orderData.contact_name || 
                 (orderData.user ? 
                  `${orderData.user.first_name || ''} ${orderData.user.last_name || ''}`.trim() || 
                  orderData.user.email || 
                  `Пользователь #${orderData.user.id}` : 
                  'Неизвестный клиент')
      };
    });
    
    // Форматируем данные популярных товаров
    const formattedPopularProducts = popularProducts.map(item => {
      const itemData = item.toJSON();
      return {
        id: itemData.flower.id,
        name: itemData.flower.name,
        image: itemData.flower.image_url,
        price: parseFloat(itemData.flower.price || 0),
        sales: parseInt(itemData.total_sold, 10)
      };
    });
    
    // Получаем статистику по статусам заказов
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status_id',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['status_id']
    });
    
    // Сопоставление status_id с текстовыми значениями
    const statusMapping = {
      1: 'new',
      2: 'processing',
      3: 'shipped',
      4: 'delivered',
      5: 'cancelled'
    };
    
    const formattedOrdersByStatus = ordersByStatus.reduce((acc, item) => {
      const data = item.toJSON();
      const statusText = statusMapping[data.status_id] || `status_${data.status_id}`;
      acc[statusText] = parseInt(data.count, 10);
      return acc;
    }, {});
    
    // Возвращаем собранную статистику
    return res.status(200).json({
      data: {
        totalOrders,
        totalUsers,
        totalProducts,
        totalCategories,
        newOrders,
        totalRevenue: parseFloat(totalRevenue || 0),
        monthlyRevenue: parseFloat(monthlyRevenue || 0),
        recentOrders: formattedRecentOrders,
        popularProducts: formattedPopularProducts,
        ordersByStatus: formattedOrdersByStatus
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка получения статистики для дашборда:', error);
    return res.status(500).json({
      data: null,
      error: 'Ошибка получения статистики: ' + error.message
    });
  }
};

module.exports = {
  getDashboardStats
}; 