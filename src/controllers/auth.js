const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { User } = require('../models');

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
 * Вспомогательная функция для генерации токена
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      is_admin: user.is_admin,
      telegram_id: user.telegram_id 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Аутентификация пользователя
 */
const login = async (req, res) => {
  try {
    console.log('Попытка входа пользователя:', req.body.email);
    const { email, password } = req.body;
    
    // Проверяем входные данные
    if (!email || !password) {
      return res.status(400).json({
        error: 'Пожалуйста, введите email и пароль',
        data: null
      });
    }
    
    // Убедимся что User - это действительно модель Sequelize
    console.log('Проверка модели User:', typeof User, User.prototype);
    
    // Ищем пользователя по email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        data: null
      });
    }
    
    // Проверяем пароль
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        data: null
      });
    }
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { 
        id: user.id, 
        is_admin: user.is_admin
      },
      process.env.JWT_SECRET || 'secret_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Возвращаем данные пользователя и токен
    res.json({
      data: {
        user: {
          id: user.id,
          name: user.getName ? user.getName() : 
                (user.first_name || user.last_name) ? 
                  `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
                  user.username || user.email,
          email: user.email,
          is_admin: user.is_admin
        },
        token
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера: ' + error.message,
      data: null
    });
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
    const { telegram_id, telegram_username, initData, user_data } = req.body;
    
    if (!telegram_id || !initData) {
      return res.status(400).json({ message: 'Отсутствуют обязательные параметры' });
    }
    
    // Проверка инициализационных данных Telegram
    // В реальном приложении здесь должна быть проверка подписи initData
    // https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    // Валидация подписи initData должна быть реализована в рабочей версии!
    
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
        
        // Обновляем информацию пользователя, если она изменилась в Telegram
        if (user_data && (telegram_username !== telegramUser.name || 
            (user_data.first_name && !telegramUser.first_name) || 
            (user_data.last_name && !telegramUser.last_name))) {
          
          // Создаем имя из first_name и last_name, если они есть
          const fullName = user_data.first_name && user_data.last_name 
            ? `${user_data.first_name} ${user_data.last_name}`
            : telegram_username || `User_${telegram_id}`;
            
          await db.query(
            `UPDATE users 
             SET name = $1, 
                 first_name = $2, 
                 last_name = $3, 
                 username = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [fullName, user_data.first_name || null, user_data.last_name || null, telegram_username || null, telegramUser.id]
          );
        }
        
        // Получаем обновленные данные пользователя
        const updatedUserResult = await db.query(
          'SELECT * FROM users WHERE id = $1',
          [telegramUser.id]
        );
        
        const updatedUser = updatedUserResult.rows[0];
        
        // Генерация JWT токена
        const token = jwt.sign({ id: updatedUser.id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN
        });
        
        // Отправляем данные пользователя без пароля
        const { password: _, ...userWithoutPassword } = updatedUser;
        
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
         SET telegram_id = $1,
             username = $2,
             first_name = $3,
             last_name = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, name, email, phone, address, telegram_id, username, first_name, last_name, is_admin, created_at`,
        [
          telegram_id, 
          telegram_username || null, 
          user_data?.first_name || null, 
          user_data?.last_name || null, 
          userId
        ]
      );
      
      return res.status(200).json({
        user: rows[0],
        telegramLinked: true
      });
    }
    
    // Если пользователь не авторизован и Telegram ID не найден, 
    // создаем новый аккаунт через Telegram
    const fullName = user_data?.first_name && user_data?.last_name 
      ? `${user_data.first_name} ${user_data.last_name}`
      : telegram_username || `User_${telegram_id}`;
      
    const { rows } = await db.query(
      `INSERT INTO users (
        name, 
        telegram_id, 
        username, 
        first_name, 
        last_name,
        is_admin
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, address, telegram_id, username, first_name, last_name, is_admin, created_at`,
      [
        fullName,
        telegram_id,
        telegram_username || null,
        user_data?.first_name || null,
        user_data?.last_name || null,
        false
      ]
    );
    
    // Генерация JWT токена
    const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
    
    return res.status(201).json({
      user: rows[0],
      token,
      telegramLinked: true,
      created: true
    });
  } catch (error) {
    console.error('Error verifying Telegram:', error);
    return res.status(500).json({ message: 'Ошибка при верификации Telegram' });
  }
};

/**
 * Выход пользователя
 */
const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ 
    data: { success: true },
    error: null 
  });
};

/**
 * Проверка сессии пользователя
 */
const checkSession = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'isAdmin']
    });
    
    if (!user) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        data: null
      });
    }
    
    res.json({
      data: { user },
      error: null
    });
    
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      data: null
    });
  }
};

/**
 * Получение профиля пользователя
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!user) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        data: null
      });
    }
    
    res.json({
      data: {
        user: user.toJSON()
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      data: null
    });
  }
};

/**
 * Обновление токена
 */
const refreshToken = async (req, res) => {
  try {
    // Получаем ID пользователя из JWT
    const { id } = req.user;
    
    // Находим пользователя в базе
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Пользователь не найден',
        data: null
      });
    }
    
    // Генерируем новый токен
    const token = user.generateToken();
    
    // Отправляем токен клиенту
    res.json({
      data: {
        user: {
          id: user.id,
          name: user.name || user.first_name + ' ' + user.last_name,
          email: user.email,
          is_admin: user.is_admin
        },
        token
      },
      error: null
    });
  } catch (error) {
    console.error('Ошибка обновления токена:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      data: null
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  verifyTelegram,
  logout,
  checkSession,
  getProfile,
  refreshToken
};