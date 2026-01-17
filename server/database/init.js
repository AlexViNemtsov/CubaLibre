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

// Упрощенная функция для создания таблиц напрямую
async function createTablesDirectly() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Создаем таблицу users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table users created');
    
    // Создаем таблицу listings
    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'items', 'services')),
        scope VARCHAR(20) NOT NULL CHECK (scope IN ('NEIGHBORHOOD', 'CITY', 'COUNTRY')),
        city VARCHAR(100) NOT NULL DEFAULT 'La Habana',
        neighborhood VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2),
        currency VARCHAR(10) DEFAULT 'CUP',
        is_negotiable BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented')),
        rent_type VARCHAR(50) CHECK (rent_type IN ('room', 'apartment', 'house')),
        rent_period VARCHAR(50) CHECK (rent_period IN ('daily', 'monthly')),
        available_from DATE,
        is_available_now BOOLEAN DEFAULT true,
        landmark TEXT,
        rooms VARCHAR(10),
        total_area DECIMAL(10, 2),
        living_area DECIMAL(10, 2),
        floor INTEGER,
        floor_from INTEGER,
        renovation VARCHAR(50),
        furniture VARCHAR(20),
        appliances VARCHAR(20),
        internet VARCHAR(20),
        item_subcategory VARCHAR(50) CHECK (item_subcategory IN ('clothing', 'electronics', 'furniture', 'kids', 'other')),
        item_condition VARCHAR(20) CHECK (item_condition IN ('new', 'used')),
        item_brand VARCHAR(100),
        delivery_type VARCHAR(50) CHECK (delivery_type IN ('pickup', 'shipping')),
        service_subcategory VARCHAR(50) CHECK (service_subcategory IN ('repair', 'cleaning', 'transport', 'food', 'other')),
        service_format VARCHAR(50) CHECK (service_format IN ('one-time', 'ongoing')),
        service_area TEXT,
        contact_telegram VARCHAR(100),
        contact_whatsapp VARCHAR(100),
        is_promoted BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        is_vip BOOLEAN DEFAULT false,
        promoted_until TIMESTAMP,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table listings created');
    
    // Создаем таблицу listing_photos
    await client.query(`
      CREATE TABLE IF NOT EXISTS listing_photos (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
        photo_url VARCHAR(500) NOT NULL,
        photo_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table listing_photos created');
    
    // Создаем индексы
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)',
      'CREATE INDEX IF NOT EXISTS idx_listings_scope ON listings(scope)',
      'CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city)',
      'CREATE INDEX IF NOT EXISTS idx_listings_neighborhood ON listings(neighborhood)',
      'CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)',
      'CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_listings_promoted ON listings(is_promoted DESC, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_listings_pinned ON listings(is_pinned DESC, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_listings_views ON listings(views DESC)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn('⚠️  Index creation warning:', err.message);
        }
      }
    }
    console.log('✅ Indexes created');
    
    // Создаем функцию для обновления updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ Function update_updated_at_column created');
    
    // Создаем триггер
    await client.query(`
      DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
      CREATE TRIGGER update_listings_updated_at 
      BEFORE UPDATE ON listings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Trigger update_listings_updated_at created');
    
    await client.query('COMMIT');
    console.log('✅ All tables created successfully');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in createTablesDirectly:', error.message);
    console.error('Error code:', error.code);
    throw error;
  } finally {
    client.release();
  }
}

// Функция для принудительного создания таблиц (используется при ошибке "relation does not exist")
async function forceCreateTables() {
  try {
    console.log('🔧 Force creating database tables...');
    
    // Сначала пробуем упрощенный метод
    try {
      await createTablesDirectly();
      return true;
    } catch (directError) {
      console.error('❌ Direct table creation failed:', directError.message);
      console.log('🔄 Trying alternative method with schema file...');
      
      // Если не получилось, пробуем через файл схемы
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Удаляем CREATE DATABASE из схемы
      const schemaWithoutDB = schema.replace(/CREATE DATABASE.*?;/i, '').trim();
      
      // Разделяем на отдельные запросы
      const queries = splitSQLQueries(schemaWithoutDB);
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i].trim();
        if (!query || query.startsWith('--')) continue;
        
        try {
          await pool.query(query);
          console.log(`✅ Force created statement ${i + 1}/${queries.length}`);
        } catch (err) {
          // Игнорируем ошибки если объекты уже существуют
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log(`⚠️  Statement ${i + 1}: Already exists`);
          } else {
            console.error(`❌ Error in force create statement ${i + 1}:`, err.message);
            console.error(`Query: ${query.substring(0, 200)}...`);
          }
        }
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
          console.log(`✅ Force migration ${migrationFile} executed`);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate') && 
              !err.message.includes('does not exist') && !err.message.includes('column')) {
            console.warn(`⚠️  Force migration ${migrationFile} warning:`, err.message);
          }
        }
      }
    }
    
    // Проверяем, что таблица listings существует
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'listings'
      );
    `);
    
    if (!check.rows[0].exists) {
      throw new Error('Table listings was not created after force creation');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in forceCreateTables:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

async function initDatabase() {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Проверяем подключение к БД
    try {
      await pool.query('SELECT NOW()');
    } catch (connError) {
      console.error('❌ Cannot connect to database:', connError.message);
      throw new Error(`Database connection failed: ${connError.message}`);
    }
    
    // Проверяем, существует ли таблица listings
    let checkTable;
    try {
      checkTable = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'listings'
        );
      `);
    } catch (checkError) {
      console.error('❌ Error checking table existence:', checkError.message);
      // Если ошибка при проверке, пытаемся создать таблицы
      console.log('🔄 Attempting to create tables despite check error...');
      await forceCreateTables();
      return;
    }
    
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
              err.message.includes('duplicate')) {
            console.log(`⚠️  Statement ${i + 1}: Object already exists, skipping`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, err.message);
            console.error(`Query preview: ${query.substring(0, 200)}...`);
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
              (err.message.includes('does not exist') && err.message.includes('column'))) {
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
      console.error('❌ Table listings does not exist after initialization, attempting force create...');
      await forceCreateTables();
      
      // Проверяем еще раз
      const recheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'listings'
        );
      `);
      
      if (!recheck.rows[0].exists) {
        throw new Error('Table listings was not created after force initialization');
      }
      console.log('✅ Table listings created successfully after force initialization');
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    // Пробуем принудительно создать таблицы
    try {
      console.log('🔄 Attempting force table creation as fallback...');
      await forceCreateTables();
      console.log('✅ Force table creation completed');
    } catch (forceError) {
      console.error('❌ Force table creation also failed:', forceError.message);
      throw error; // Выбрасываем оригинальную ошибку
    }
  }
}

module.exports = { pool, initDatabase, forceCreateTables, createTablesDirectly };

