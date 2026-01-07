const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cuba_clasificados',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Удаляем CREATE DATABASE из схемы для подключения к существующей БД
    const schemaWithoutDB = schema.replace(/CREATE DATABASE.*?;/i, '');
    
    // Разделяем на отдельные запросы
    const queries = schemaWithoutDB
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));
    
    for (const query of queries) {
      if (query.trim()) {
        try {
          await pool.query(query);
        } catch (err) {
          // Игнорируем ошибки если таблицы уже существуют
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.warn('Warning executing query:', err.message);
          }
        }
      }
    }
    
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    // Не прерываем выполнение, если БД уже инициализирована
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

module.exports = { pool, initDatabase };

