module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('orderitem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'flowers',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'order_items',
    timestamps: false,
    underscored: true
  });

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.order, {
      foreignKey: 'order_id',
      as: 'order'
    });
    
    OrderItem.belongsTo(models.flower, {
      foreignKey: 'product_id',
      as: 'flower'
    });
  };

  return OrderItem;
}; 