const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const routes = require('./routes');
const fs = require('fs');

// Инициализация приложения Express
const app = express();

// Промежуточное ПО для безопасности
app.use(helmet({
  contentSecurityPolicy: false, // В продакшене рекомендуется включить
}));

// Настройка CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // В продакшене лучше указать конкретный домен
  credentials: true
}));

// Парсинг JSON и URL-encoded тел запросов
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Парсинг куков
app.use(cookieParser());

// Создаем директорию для загрузок, если она не существует
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка статических файлов
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Маршруты API
app.use('/api', routes);

// Обработка 404 для всех остальных маршрутов
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Маршрут не найден',
    data: null
  });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Не обработанная ошибка:', err);
  
  // Ошибка с multer для загрузки файлов
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: `Ошибка загрузки файла: ${err.message}`,
      data: null
    });
  }
  
  res.status(500).json({
    error: 'Внутренняя ошибка сервера: ' + (process.env.NODE_ENV === 'production' ? 'Подробности в логах' : err.message),
    data: null
  });
});

module.exports = app; 