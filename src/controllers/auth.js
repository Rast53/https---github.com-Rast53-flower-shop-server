const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Регистрация нового пользователя
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    // Проверка обязательных полей
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Имя, email и пароль обязательны' });
    }
    
    // Проверка, что email не занят
    const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }
    
    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Создание пользователя
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, address, is_admin, created_at`,
      [name, email, hashedPassword, phone, address]
    );
    
    // Генерация JWT токена
    const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
    
    return res.status(201).json({
      user: rows[0],
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Ошибка при регистрации пользователя' });
  }
};

/**
 * Аутентификация пользователя
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Проверка обязательных полей
    if (!email || !password) {
      return res.status(400).json({ message: 'Email и пароль обязательны' });
    }
    
    // Поиск пользователя по email
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    const user = rows[0];
    
    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    // Генерация JWT токена
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
    
    // Отправляем данные пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Ошибка при входе в систему' });
  }
};

/**
 * Получение данных текущего пользователя
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { rows } = await db.query(
      'SELECT id, name, email, phone, address, telegram_id, is_admin, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error getting user:', error);
    return res.status(500).json({ message: 'Ошибка при получении данных пользователя' });
  }
};

/**
 * Обновление данных пользователя
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, address, currentPassword, newPassword } = req.body;
    
    // Проверяем, существует ли пользователь
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const user = userCheck.rows[0];
    
    // Если пользователь хочет изменить пароль
    if (currentPassword && newPassword) {
      // Проверяем текущий пароль
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Неверный текущий пароль' });
      }
      
      // Хешируем новый пароль
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Обновляем пользователя
      const { rows } = await db.query(
        `UPDATE users 
         SET name = $1, phone = $2, address = $3, password = $4
         WHERE id = $5
         RETURNING id, name, email, phone, address, is_admin, created_at`,
        [name || user.name, phone || user.phone, address || user.address, hashedPassword, userId]
      );
      
      return res.status(200).json(rows[0]);
    } else {
      // Обновляем только профиль без пароля
      const { rows } = await db.query(
        `UPDATE users 
         SET name = $1, phone = $2, address = $3
         WHERE id = $4
         RETURNING id, name, email, phone, address, is_admin, created_at`,
        [name || user.name, phone || user.phone, address || user.address, userId]
      );
      
      return res.status(200).json(rows[0]);
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Ошибка при обновлении профиля' });
  }
};

/**
 * Верификация и связывание с Telegram аккаунтом
 */
const verifyTelegram = async (req, res) => {
  try {
    const { telegram_id, telegram_username, initData } = req.body;
    
    if (!telegram_id || !initData) {
      return res.status(400).json({ message: 'Отсутствуют обязательные параметры' });
    }
    
    // Проверка инициализационных данных Telegram
    // В реальном приложении здесь должна быть проверка подписи initData
    // https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    
    let userId = null;
    let user = null;
    
    // Если пользователь авторизован, привязываем Telegram к его аккаунту
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        
        // Проверяем, что пользователь существует
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length > 0) {
          user = userResult.rows[0];
        }
      } catch (error) {
        console.error('Invalid token:', error);
      }
    }
    
    // Проверяем, есть ли уже пользователь с таким telegram_id
    const telegramCheck = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegram_id]);
    
    if (telegramCheck.rows.length > 0) {
      // Если этот Telegram уже привязан к другому аккаунту
      if (userId && telegramCheck.rows[0].id !== userId) {
        return res.status(400).json({ 
          message: 'Этот Telegram аккаунт уже привязан к другому пользователю'
        });
      }
      
      // Если пользователь не авторизован, но Telegram ID найден, входим с помощью Telegram
      if (!userId) {
        const telegramUser = telegramCheck.rows[0];
        
        // Генерация JWT токена
        const token = jwt.sign({ id: telegramUser.id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN
        });
        
        // Отправляем данные пользователя без пароля
        const { password: _, ...userWithoutPassword } = telegramUser;
        
        return res.status(200).json({
          user: userWithoutPassword,
          token,
          telegramLinked: true
        });
      }
    }
    
    // Если пользователь авторизован, привязываем Telegram ID к его аккаунту
    if (userId && user) {
      const { rows } = await db.query(
        `UPDATE users 
         SET telegram_id = $1
         WHERE id = $2
         RETURNING id, name, email, phone, address, telegram_id, is_admin, created_at`,
        [telegram_id, userId]
      );
      
      return res.status(200).json({
        user: rows[0],
        telegramLinked: true
      });
    }
    
    // Если пользователь не авторизован и Telegram ID не найден, 
    // создаем новый аккаунт через Telegram
    const { rows } = await db.query(
      `INSERT INTO users (name, telegram_id, is_admin)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, phone, address, telegram_id, is_admin, created_at`,
      [telegram_username || `User_${telegram_id}`, telegram_id, false]
    );
    
    // Генерация JWT токена
    const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
    
    return res.status(201).json({
      user: rows[0],
      token,
      telegramLinked: true
    });
  } catch (error) {
    console.error('Error verifying Telegram:', error);
    return res.status(500).json({ message: 'Ошибка при верификации Telegram' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  verifyTelegram
};