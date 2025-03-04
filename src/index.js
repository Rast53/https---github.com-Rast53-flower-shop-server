const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const helmet = require("helmet");
const { sequelize } = require('./models');

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Улучшенные настройки CORS для безопасности
// Разрешаем все источники для отладки (в продакшне нужно будет ограничить)
const corsOptions = {
  origin: '*',  // Временно разрешаем все источники для отладки
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 часа
};

// CORS Middleware (добавляем во всех ответах)
app.use(cors(corsOptions));

// Предварительная обработка OPTIONS запросов для CORS
app.options('*', cors(corsOptions));

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Основные middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Добавляем Helmet для защиты заголовков
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// Добавляем эндпоинт для проверки CORS
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CORS работает корректно',
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Подключение маршрутов
const flowerRoutes = require("./routes/flowers");
const categoryRoutes = require("./routes/categories");
const orderRoutes = require("./routes/orders");
const authRoutes = require("./routes/auth");

app.use("/api/flowers", flowerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);

// Базовый маршрут для проверки работы API
app.get("/", (req, res) => {
  res.json({ 
    message: "Flower Shop API is working!", 
    https: req.secure,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Добавьте health check эндпоинт
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    https: req.secure,
    environment: process.env.NODE_ENV
  });
});

// Добавим эндпоинт для проверки здоровья
app.get('/health-check', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Настройка HTTPS сервера
const startServer = () => {
  // Проверка флага для принудительного использования HTTP
  if (process.env.USE_HTTP === 'true') {
    console.log('Starting HTTP server as requested by USE_HTTP flag');
    return startHttpServer();
  }

  // Проверка окружения
  if (process.env.NODE_ENV === 'production') {
    try {
      // Пути к сертификатам
      const certPath = process.env.CERT_PATH || '/app/fullchain.pem';
      const keyPath = process.env.KEY_PATH || '/app/privkey.pem';
      
      // Проверка наличия сертификатов
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        // Настройка HTTPS сервера с усиленными параметрами безопасности
        const httpsOptions = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          minVersion: 'TLSv1.2',
          ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
          honorCipherOrder: true
        };
        
        // Создание HTTPS сервера
        const httpsServer = https.createServer(httpsOptions, app);
        httpsServer.listen(PORT, '0.0.0.0', () => {
          console.log(`HTTPS Server running on port ${PORT} in production mode`);
        });
      } else {
        console.warn("SSL certificates not found, falling back to HTTP");
        // Если сертификаты не найдены, используем HTTP
        startHttpServer();
      }
    } catch (error) {
      console.error("Error starting HTTPS server:", error);
      console.warn("Falling back to HTTP server");
      startHttpServer();
    }
  } else {
    // В режиме разработки используем обычный HTTP
    startHttpServer();
  }
};

// Функция для запуска HTTP сервера
const startHttpServer = () => {
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Server running on port ${PORT}`);
  });
};

// Запуск сервера
const initModels = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');
    
    await sequelize.sync();
    console.log('Database synchronized');
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

// Запуск сервера
initModels();
startServer(); 

app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.get('/api/test', (req, res) => {
  res.json({
    data: { message: 'Тестовый запрос успешен' },
    error: null
  });
}); 

// Подключаем маршруты
app.use('/api/categories', require('./routes/categories'));
app.use('/api/flowers', require('./routes/flowers')); 