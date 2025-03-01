const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.json({ message: "Flower Shop API is working!" });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 