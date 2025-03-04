'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Добавляем телеграм-поля, если их нет
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS username VARCHAR(255),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      -- Переименуем is_admin, если имя колонки отличается
      ALTER TABLE users RENAME COLUMN isAdmin TO is_admin;
    `);
  },

  async down(queryInterface, Sequelize) {
    // В случае отката не удаляем колонки, чтобы не потерять данные
  }
}; 