const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const listingsRouter = require('./routes/listings');
const citiesRouter = require('./routes/cities');
const subscriptionRouter = require('./routes/subscription');
const { initDatabase, pool } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы (загруженные изображения)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/listings', listingsRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/subscription', subscriptionRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Инициализация базы данных при запуске
initDatabase().then(() => {
  // Проверяем, что таблица listings существует
  return pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'listings'
    );
  `);
}).then((result) => {
  if (!result.rows[0].exists) {
    throw new Error('Table listings does not exist after initialization');
  }
  console.log('✅ Database tables verified');
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'cuba_clasificados'}`);
  });
}).catch((error) => {
  console.error('❌ Failed to initialize database:', error.message);
  console.error('Stack:', error.stack);
  console.log('💡 Убедитесь, что база данных создана и настройки в .env правильные');
  console.log('💡 Проверьте логи выше для деталей ошибки');
  
  // Запускаем сервер даже если БД не инициализирована
  // Но предупреждаем, что функциональность будет ограничена
  app.listen(PORT, () => {
    console.log(`⚠️  Server running on port ${PORT} (БД не инициализирована - некоторые функции не работают)`);
    console.log(`💡 Перезапустите сервер после исправления проблемы с БД`);
  });
});

