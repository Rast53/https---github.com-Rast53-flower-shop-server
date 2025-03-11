const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { user: User } = require('../models');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
    const token = jwt.sign({ id: rows[0].id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
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
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Аутентификация пользователя
 */
const login = async (req, res) => {
  try {
    console.log('Попытка входа пользователя:', req.body.email);
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Пожалуйста, укажите email и пароль',
        data: null
      });
    }
    
    // Ищем пользователя по email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        data: null
      });
    }
    
    // Проверяем пароль
    const passwordValid = await checkPassword(user, password);
    
    if (!passwordValid) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        data: null
      });
    }
    
    // Генерируем JWT токен
    const token = generateToken(user);
    
    // Получаем имя пользователя
    const name = getUserName(user);
    
    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          is_admin: Boolean(user.is_admin),
          name: name
        }
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
 * Проверка сессии пользователя
 */
const checkSession = async (req, res) => {
  try {
    console.log('Запрос на проверку сессии:', {
      headers: req.headers,
      user: req.user || 'не определен'
    });
    
    // Проверяем заголовок авторизации напрямую, если middleware не сработал
    if (!req.user) {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Заголовок авторизации отсутствует или некорректен');
        return res.status(401).json({
          error: 'Пользователь не авторизован',
          data: null
        });
      }
      
      try {
        const token = authHeader.split(' ')[1];
        console.log('Пробуем декодировать токен напрямую');
        
        // Проверяем токен
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Токен успешно декодирован:', decoded);
        
        // Проверяем доступные модели
        console.log('Доступные модели:', Object.keys(require('../models')));
        
        // Находим пользователя в базе данных
        const user = await User.findByPk(decoded.id);
        console.log('Пользователь найден:', !!user);
        
        if (!user) {
          return res.status(401).json({
            error: 'Пользователь не найден или заблокирован',
            data: null
          });
        }
        
        // Возвращаем данные пользователя
        return res.json({
          data: { 
            user: {
              id: user.id,
              name: getUserName(user),
              email: user.email,
              telegram_id: user.telegram_id,
              username: user.username,
              first_name: user.first_name,
              last_name: user.last_name,
              is_admin: Boolean(user.is_admin)
            }
          },
          error: null
        });
      } catch (error) {
        console.error('Ошибка при проверке токена:', error);
        return res.status(401).json({
          error: 'Неверный токен авторизации',
          data: null
        });
      }
    }
    
    // Стандартная обработка, если middleware добавил req.user
    console.log('Ищем пользователя по ID:', req.user.id);
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'username', 'first_name', 'last_name', 'telegram_id', 'is_admin']
    });
    
    if (!user) {
      console.log('Пользователь не найден в базе данных');
      return res.status(404).json({
        error: 'Пользователь не найден',
        data: null
      });
    }
    
    console.log('Пользователь найден, отправляем данные');
    res.json({
      data: { user },
      error: null
    });
    
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    console.error('Стек ошибки:', error.stack);
    res.status(500).json({
      error: 'Ошибка сервера: ' + error.message,
      data: null
    });
  }
};

/**
 * Получение данных о текущем пользователе
 */
const getMe = checkSession; // Используем тот же метод для /me

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
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const token = jwt.sign({ id: updatedUser.id }, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN
        });
        
        // Отправляем данные пользователя без пароля
        const { password: _, ...userWithoutPassword } = updatedUser;
        
        return res.status(200).json({
          user: {
            id: updatedUser.id,
            name: getUserName(updatedUser),
            email: updatedUser.email,
            is_admin: Boolean(updatedUser.is_admin),
            telegram_id: updatedUser.telegram_id
          },
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
        user: {
          id: rows[0].id,
          name: getUserName(rows[0]),
          email: rows[0].email,
          is_admin: Boolean(rows[0].is_admin),
          telegram_id: rows[0].telegram_id
        },
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
    const token = jwt.sign({ id: rows[0].id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    
    return res.status(201).json({
      user: {
        id: rows[0].id,
        name: getUserName(rows[0]),
        email: rows[0].email,
        is_admin: Boolean(rows[0].is_admin),
        telegram_id: rows[0].telegram_id
      },
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
          name: getUserName(user),
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

// Проверка пароля
const checkPassword = async (user, password) => {
  return password && user.password_hash 
    ? await bcrypt.compare(password, user.password_hash) 
    : false;
};

// Получение имени пользователя
const getUserName = (user) => {
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return user.username || user.email || `User-${user.id}`;
};

/**
 * Авторизация через Telegram
 */
const telegramAuth = async (req, res) => {
  try {
    console.log('Получен запрос на авторизацию через Telegram:', req.body);
    
    const { telegram_id, username, first_name, last_name, initData } = req.body;
    
    if (!telegram_id) {
      console.error('Отсутствует идентификатор Telegram в запросе');
      return res.status(400).json({ 
        error: 'Отсутствует идентификатор Telegram',
        data: null
      });
    }
    
    // Преобразуем telegram_id в строку, если он передан как число
    const telegramIdString = String(telegram_id);
    console.log('Ищем пользователя по Telegram ID:', telegramIdString);
    
    // Проверяем доступные модели
    console.log('Доступные модели:', Object.keys(require('../models')));
    console.log('Модель User доступна:', !!User);
    
    // Ищем пользователя по идентификатору Telegram
    let user = await User.findOne({ where: { telegram_id: telegramIdString } });
    console.log('Результат поиска пользователя:', user ? 'Найден' : 'Не найден');
    
    // Если пользователь не найден, создаем нового
    if (!user) {
      console.log('Создаем нового пользователя с данными:', { 
        telegram_id: telegramIdString, 
        username, 
        first_name, 
        last_name 
      });
      const randomPassword = crypto.randomBytes(16).toString('hex');
      
      user = await User.create({
        telegram_id: telegramIdString, // Сохраняем как строку
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        email: `${telegramIdString}@telegram.user`, // Временный email для совместимости
        password_hash: await bcrypt.hash(randomPassword, 10),
        is_active: true,
        is_admin: false, // По умолчанию пользователи Telegram не администраторы
        telegram_data: JSON.stringify({
          first_name,
          last_name,
          username
        })
      });
    } else {
      // Обновляем существующие данные пользователя
      await user.update({
        username: username || user.username,
        first_name: first_name || user.first_name,
        last_name: last_name || user.last_name,
        telegram_data: JSON.stringify({
          first_name,
          last_name,
          username
        })
      });
    }
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { 
        id: user.id,
        telegram_id: user.telegram_id,
        is_admin: user.is_admin 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('Сгенерирован JWT токен для пользователя:', {
      userId: user.id,
      telegramId: user.telegram_id,
      isAdmin: user.is_admin,
      tokenLength: token.length
    });
    
    // Возвращаем данные пользователя и токен в едином формате
    const responseData = {
      data: {
        user: {
          id: user.id,
          name: getUserName(user),
          email: user.email,
          is_admin: Boolean(user.is_admin),
          telegram_id: user.telegram_id
        },
        token
      },
      error: null
    };
    
    console.log('Отправляем ответ с данными пользователя:', {
      userId: responseData.data.user.id,
      telegramId: responseData.data.user.telegram_id,
      isAdmin: responseData.data.user.is_admin,
      hasToken: !!responseData.data.token
    });
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Ошибка при авторизации через Telegram:', error);
    console.error('Стек ошибки:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка сервера при авторизации через Telegram: ' + error.message,
      data: null
    });
  }
};

/**
 * Регистрация пользователя через Telegram
 * @route POST /api/users/telegram-register
 * @access Public
 */
const telegramRegister = async (req, res) => {
  try {
    const { telegram_id, first_name, last_name, username } = req.body;
    
    // Проверка обязательных полей
    if (!telegram_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram ID обязателен' 
      });
    }
    
    // Проверяем, существует ли пользователь с таким telegram_id
    const existingUser = await User.findOne({ 
      where: { telegram_id: telegram_id.toString() } 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Пользователь с таким Telegram ID уже зарегистрирован',
        user: {
          id: existingUser.id,
          telegram_id: existingUser.telegram_id,
          username: existingUser.username,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name
        }
      });
    }
    
    // Создаем пользователя
    const user = await User.create({
      telegram_id: telegram_id.toString(),
      first_name,
      last_name,
      username,
      telegram_data: JSON.stringify({
        registration_date: new Date(),
        registration_source: 'telegram_bot'
      }),
      is_active: true
    });
    
    // Генерируем токен
    const token = user.generateToken();
    
    // Логируем успешную регистрацию
    console.log(`Новый пользователь зарегистрирован через Telegram: ${telegram_id}`);
    
    return res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован через Telegram',
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      },
      token
    });
  } catch (error) {
    console.error('Ошибка при регистрации пользователя через Telegram:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера при регистрации пользователя через Telegram'
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
  refreshToken,
  telegramAuth,
  telegramRegister
};