module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('review', {
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
    flower_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'flowers',
        key: 'id'
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    comment: {
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
    tableName: 'reviews',
    timestamps: false,
    underscored: true
  });

  Review.associate = (models) => {
    Review.belongsTo(models.user, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    Review.belongsTo(models.flower, {
      foreignKey: 'flower_id',
      as: 'flower'
    });
  };

  return Review;
}; 