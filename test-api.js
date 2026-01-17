/**
 * Простой скрипт для тестирования API и создания тестового объявления
 * Работает без Telegram auth (только для разработки)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cuba_clasificados',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createTestListing() {
  try {
    console.log('🔌 Подключение к базе данных...');
    
    // Создаем тестового пользователя
    const userResult = await pool.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
      RETURNING id
    `, [123456789, 'testuser', 'Test', 'User']);
    
    const userId = userResult.rows[0].id;
    console.log('✅ Пользователь создан/найден, ID:', userId);
    
    // Создаем тестовое объявление
    const listingResult = await pool.query(`
      INSERT INTO listings (
        user_id, category, scope, city, neighborhood, title, description,
        price, currency, is_negotiable,
        rent_type, rent_period, is_available_now, landmark,
        contact_telegram, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, title, created_at
    `, [
      userId,
      'rent',                    // category
      'NEIGHBORHOOD',            // scope
      'La Habana',               // city
      'Vedado',                  // neighborhood
      'Квартира в центре Vedado', // title
      'Уютная квартира с 2 спальнями в центре Vedado. Рядом с университетом и парком. Меблированная, со всеми удобствами. Идеально для студентов или молодой семьи.', // description
      50000,                     // price
      'CUP',                     // currency
      false,                     // is_negotiable
      'apartment',               // rent_type
      'monthly',                 // rent_period
      true,                      // is_available_now
      'Рядом с университетом, парк John Lennon', // landmark
      '@testuser',               // contact_telegram
      'active'                   // status
    ]);
    
    const listing = listingResult.rows[0];
    console.log('\n✅ Тестовое объявление успешно создано!');
    console.log('📋 Детали:');
    console.log('   ID:', listing.id);
    console.log('   Название:', listing.title);
    console.log('   Создано:', listing.created_at);
    console.log('\n🌐 Проверьте объявление:');
    console.log('   http://localhost:3000/api/listings/' + listing.id);
    console.log('   http://localhost:3000/api/listings');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Убедитесь, что PostgreSQL запущен');
      console.log('💡 Проверьте настройки в .env файле');
    } else if (error.code === '42P01') {
      console.log('\n💡 База данных не инициализирована');
      console.log('💡 Запустите сервер один раз для автоматической инициализации');
    } else {
      console.log('\n💡 Полная ошибка:', error);
    }
  } finally {
    await pool.end();
  }
}

// Запуск
console.log('🚀 Создание тестового объявления...\n');
createTestListing();




