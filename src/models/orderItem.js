module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('orderitem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    flower_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'flowers',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
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
      foreignKey: 'flower_id',
      as: 'flower'
    });
  };

  return OrderItem;
}; 