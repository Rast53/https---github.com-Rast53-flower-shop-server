const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const db = require('../config/db');

const models = {};

// Загрузка моделей
fs.readdirSync(__dirname)
  .filter(file => {
    return file.indexOf('.') !== 0 && 
           file !== 'index.js' && 
           file.slice(-3) === '.js';
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(db, Sequelize.DataTypes);
    console.log(`Загружена модель: ${file} -> ${model.name}`);
    // Используем название модели в нижнем регистре для соответствия с таблицами
    models[model.name.toLowerCase()] = model;
  });

// Проверяем наличие всех необходимых моделей в коллекции
console.log('Доступные модели:', Object.keys(models));

// Установка ассоциаций между моделями
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    try {
      models[modelName].associate(models);
      console.log(`Установлены ассоциации для модели: ${modelName}`);
    } catch (error) {
      console.error(`Ошибка при установке ассоциаций для модели ${modelName}:`, error.message);
    }
  }
});

models.sequelize = db;
models.sequelize_library = Sequelize;

// Проверка имен всех моделей в логах
console.log('Имена моделей после загрузки:', Object.keys(models));

// После загрузки всех моделей, проверяем каждую на правильность регистра имени
console.log('Проверка моделей на правильность регистра:');
Object.keys(models).forEach(modelName => {
  if (modelName !== modelName.toLowerCase()) {
    console.error(`ОШИБКА: Имя модели ${modelName} содержит символы верхнего регистра!`);
  } else {
    console.log(`Имя модели ${modelName} корректно`);
  }
});

module.exports = models; 