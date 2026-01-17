const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Определяем пользователя БД по умолчанию (имя текущего пользователя системы)
const defaultDbUser = process.env.USER || process.env.USERNAME || 'postgres';

// Настройка подключения к БД
// Render предоставляет DATABASE_URL, но мы также поддерживаем отдельные переменные
let poolConfig = {};

if (process.env.DATABASE_URL) {
  // Используем DATABASE_URL если он есть (Render, Railway и т.д.)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
  };
  console.log('📊 Using DATABASE_URL for connection');
} else {
  // Используем отдельные переменные
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'cuba_clasificados',
    user: process.env.DB_USER || defaultDbUser,
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
  };
  console.log('📊 Using individual DB variables for connection');
}

const pool = new Pool(poolConfig);

// Обработка ошибок подключения
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Тестовое подключение при инициализации
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('💡 Проверьте настройки в .env файле:');
    if (process.env.DATABASE_URL) {
      console.error('   DATABASE_URL: установлен (скрыт)');
    } else {
      console.error('   DB_HOST:', process.env.DB_HOST || 'localhost');
      console.error('   DB_PORT:', process.env.DB_PORT || 5432);
      console.error('   DB_NAME:', process.env.DB_NAME || 'cuba_clasificados');
      console.error('   DB_USER:', process.env.DB_USER || 'postgres');
    }
    console.error('   NODE_ENV:', process.env.NODE_ENV);
  } else {
    console.log('✅ Database connection successful');
    if (process.env.DATABASE_URL) {
      console.log('📊 Connected using DATABASE_URL');
    } else {
      console.log('📊 Connected using individual DB variables');
    }
  }
});

// Функция для правильного разделения SQL-запросов
function splitSQLQueries(sql) {
  const queries = [];
  let currentQuery = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;
  
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Проверяем начало блока $$ (dollar quoting)
    if (char === '$' && nextChar === '$') {
      // Находим тег (например, $$ или $tag$)
      let tagEnd = i + 2;
      while (tagEnd < sql.length && sql[tagEnd] !== '$') {
        tagEnd++;
      }
      dollarTag = sql.substring(i, tagEnd + 1);
      
      if (!inDollarQuote) {
        inDollarQuote = true;
      } else if (sql.substring(i, i + dollarTag.length) === dollarTag) {
        inDollarQuote = false;
        currentQuery += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = '';
      } else {
        currentQuery += char;
      }
    } else if (char === ';' && !inDollarQuote) {
      // Конец запроса
      const trimmed = currentQuery.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        queries.push(trimmed);
      }
      currentQuery = '';
    } else {
      currentQuery += char;
    }
    
    i++;
  }
  
  // Добавляем последний запрос, если он есть
  const trimmed = currentQuery.trim();
  if (trimmed && !trimmed.startsWith('--')) {
    queries.push(trimmed);
  }
  
  return queries;
}

async function initDatabase() {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Проверяем, существует ли таблица listings
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'listings'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('✅ Table listings already exists, skipping schema creation');
    } else {
      console.log('📋 Creating database schema...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Удаляем CREATE DATABASE из схемы для подключения к существующей БД
      const schemaWithoutDB = schema.replace(/CREATE DATABASE.*?;/i, '').trim();
      
      // Разделяем на отдельные запросы с учетом блоков $$
      const queries = splitSQLQueries(schemaWithoutDB);
      
      console.log(`📝 Found ${queries.length} SQL statements to execute`);
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i].trim();
        if (!query || query.startsWith('--')) continue;
        
        try {
          await pool.query(query);
          console.log(`✅ Executed statement ${i + 1}/${queries.length}`);
        } catch (err) {
          // Игнорируем ошибки если объекты уже существуют
          if (err.message.includes('already exists') || 
              err.message.includes('duplicate') ||
              err.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}: Object already exists, skipping`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, err.message);
            console.error(`Query: ${query.substring(0, 200)}...`);
            // Не прерываем выполнение, продолжаем с другими запросами
          }
        }
      }
    }
    
    // Выполняем миграции
    console.log('🔄 Running migrations...');
    const migrationFiles = [
      'migration_add_apartment_fields.sql',
      'migration_add_views.sql'
    ];
    
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(__dirname, migrationFile);
      if (fs.existsSync(migrationPath)) {
        try {
          const migration = fs.readFileSync(migrationPath, 'utf8');
          await pool.query(migration);
          console.log(`✅ Migration ${migrationFile} executed successfully`);
        } catch (err) {
          // Игнорируем ошибки если миграция уже выполнена
          if (err.message.includes('already exists') || 
              err.message.includes('duplicate') ||
              err.message.includes('does not exist') && err.message.includes('column')) {
            console.log(`⚠️  Migration ${migrationFile}: Already applied or column exists`);
          } else {
            console.warn(`⚠️  Warning executing migration ${migrationFile}:`, err.message);
          }
        }
      } else {
        console.log(`⚠️  Migration file ${migrationFile} not found, skipping`);
      }
    }
    
    // Финальная проверка: убеждаемся, что таблица listings существует
    const finalCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'listings'
      );
    `);
    
    if (finalCheck.rows[0].exists) {
      console.log('✅ Database schema initialized successfully');
    } else {
      throw new Error('Table listings was not created after initialization');
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('Stack:', error.stack);
    // Не прерываем выполнение, если БД уже инициализирована
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

module.exports = { pool, initDatabase };

