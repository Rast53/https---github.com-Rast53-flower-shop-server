const { Pool } = require('pg');
require('dotenv').config();

// Создаем соединение с базой данных
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Проверяем структуру таблиц
async function checkTables() {
  try {
    console.log('Проверка структуры таблиц...');
    
    // Проверяем таблицу categories
    const categoriesResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
      ORDER BY column_name;
    `);
    
    console.log('Структура таблицы categories:');
    categoriesResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // Проверяем таблицу flowers
    const flowersResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flowers'
      ORDER BY column_name;
    `);
    
    console.log('\nСтруктура таблицы flowers:');
    flowersResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // Если есть дублирующиеся колонки, они будут видны в выводе
    
    pool.end();
  } catch (error) {
    console.error('Ошибка при проверке структуры таблиц:', error);
    pool.end();
  }
}

checkTables(); 