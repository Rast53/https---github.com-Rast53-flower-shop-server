const { Sequelize } = require('sequelize');
require('dotenv').config();

const debugSequelize = process.env.NODE_ENV !== 'production';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    define: {
      underscored: true,
      timestamps: true
    },
    logging: debugSequelize ? console.log : false,
    dialectOptions: {
      useUTC: false
    },
    timezone: '+00:00',
    quoteIdentifiers: false
  }
);

module.exports = sequelize; 