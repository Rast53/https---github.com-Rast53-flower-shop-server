const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Удаляем поле name, если его нет в БД
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telegram_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
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
    tableName: 'users',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password_hash = await bcrypt.hash(user.password, 10);
          delete user.password;
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password') && user.password) {
          user.password_hash = await bcrypt.hash(user.password, 10);
          delete user.password;
        }
      }
    }
  });

  User.associate = (models) => {
    User.hasMany(models.order, {
      foreignKey: 'user_id',
      as: 'orders'
    });
    
    // Другие ассоциации, если они есть...
  };

  // Виртуальный атрибут name
  User.prototype.getName = function() {
    if (this.first_name || this.last_name) {
      return [this.first_name, this.last_name].filter(Boolean).join(' ');
    }
    return this.username || this.email || `User-${this.id}`;
  };

  // Метод для проверки пароля
  User.prototype.checkPassword = async function(password) {
    return password && this.password_hash 
      ? await bcrypt.compare(password, this.password_hash) 
      : false;
  };

  // Метод для генерации JWT токена
  User.prototype.generateToken = function() {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: this.id, 
        is_admin: this.is_admin,
        telegram_id: this.telegram_id 
      },
      process.env.JWT_SECRET || 'secret_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    return token;
  };

  return User;
}; 