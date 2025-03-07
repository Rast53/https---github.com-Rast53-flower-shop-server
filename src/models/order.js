module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // telegram_user_id убираем или делаем комментарий, так как этого поля нет в базе
    // telegram_user_id: {
    //   type: DataTypes.STRING,
    //   allowNull: true
    // },
    // Заменяем поле status на status_id
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // в БД поле допускает NULL
      defaultValue: 1, // 1 = new
    },
    // Заменяем total_price на total_amount, которое есть в БД
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false // в БД поле NOT NULL
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Добавляем поле contact_phone, которое есть в БД
    contact_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Добавляем поле contact_name, которое есть в БД
    contact_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // В БД нет payment_method и payment_status, удаляем эти поля
    /*
    payment_method: {
      type: DataTypes.STRING,
      allowNull: true
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    */
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'orders',
    timestamps: false,
    underscored: true
  });

  Order.associate = (models) => {
    Order.belongsTo(models.user, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    Order.hasMany(models.orderitem, {
      foreignKey: 'order_id',
      as: 'items'
    });
  };

  return Order;
}; 