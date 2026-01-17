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

async function initDatabase() {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Сначала проверяем, существует ли таблица listings
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'listings'
      );
    `);
    
    const tableExists = checkTable.rows[0].exists;
    console.log('📊 Table "listings" exists:', tableExists);
    
    if (tableExists) {
      console.log('✅ Database tables already exist, skipping schema creation');
    } else {
      console.log('📝 Creating database schema...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        console.error('❌ Schema file not found:', schemaPath);
        throw new Error('Schema file not found');
      }
      
      const schema = fs.readFileSync(schemaPath, 'utf8');
      console.log('📄 Schema file loaded, size:', schema.length, 'bytes');
      
      // Удаляем CREATE DATABASE из схемы для подключения к существующей БД
      const schemaWithoutDB = schema.replace(/CREATE DATABASE.*?;/i, '');
      
      // Разделяем на отдельные запросы
      const queries = schemaWithoutDB
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.startsWith('--') && !q.toLowerCase().startsWith('use '));
      
      console.log('📝 Found', queries.length, 'queries to execute');
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        if (query.trim()) {
          try {
            await pool.query(query);
            console.log(`✅ [${i + 1}/${queries.length}] Executed query successfully`);
          } catch (err) {
            // Игнорируем ошибки если таблицы уже существуют
            if (err.message.includes('already exists') || err.message.includes('duplicate')) {
              console.log(`ℹ️  [${i + 1}/${queries.length}] Already exists, skipping`);
            } else {
              console.error(`❌ [${i + 1}/${queries.length}] Error executing query:`, err.message);
              console.error('Query:', query.substring(0, 100) + '...');
              // Не прерываем выполнение, продолжаем создавать остальные таблицы
            }
          }
        }
      }
      
      // Проверяем что таблица создана
      const verifyTable = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'listings'
        );
      `);
      
      if (verifyTable.rows[0].exists) {
        console.log('✅ Database schema created successfully - listings table exists');
      } else {
        console.error('❌ WARNING: listings table was not created!');
        throw new Error('Failed to create listings table');
      }
    }
    
    // Выполняем миграции
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
          if (!err.message.includes('already exists') && !err.message.includes('duplicate') && !err.message.includes('already exists')) {
            console.warn(`Warning executing migration ${migrationFile}:`, err.message);
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

