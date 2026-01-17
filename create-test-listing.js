/**
 * Скрипт для создания тестового объявления
 * Использование: node create-test-listing.js
 */

const https = require('http');

// Данные тестового объявления
const testListing = {
  category: 'rent',
  scope: 'NEIGHBORHOOD',
  city: 'La Habana',
  neighborhood: 'Vedado',
  title: 'Квартира в центре Vedado',
  description: 'Уютная квартира с 2 спальнями в центре Vedado. Рядом с университетом и парком. Меблированная, со всеми удобствами.',
  price: '50000',
  currency: 'CUP',
  is_negotiable: false,
  rent_type: 'apartment',
  rent_period: 'monthly',
  is_available_now: true,
  landmark: 'Рядом с университетом, парк John Lennon',
  contact_telegram: '@testuser'
};

// Для тестирования без Telegram auth, можно использовать пустой initData
// В реальном приложении initData приходит из Telegram Web App
const initData = '';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/listings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData
  }
};

console.log('📝 Создание тестового объявления...');
console.log('📋 Данные:', JSON.stringify(testListing, null, 2));

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 201) {
      console.log('✅ Объявление успешно создано!');
      console.log('📄 Ответ:', JSON.stringify(JSON.parse(data), null, 2));
    } else {
      console.error('❌ Ошибка:', res.statusCode);
      console.error('📄 Ответ:', data);
      
      if (res.statusCode === 401) {
        console.log('\n💡 Совет: Для создания объявления через API нужна Telegram авторизация.');
        console.log('💡 Лучше создавать объявления через Web App интерфейс в Telegram.');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка подключения:', error.message);
  console.log('\n💡 Убедитесь, что сервер запущен на порту 3000');
  console.log('💡 Запустите: npm run dev');
});

req.write(JSON.stringify(testListing));
req.end();




