const express = require('express');
const router = express.Router();
const { pool } = require('../database/init');
const { optionalAuthenticateTelegram } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'listing-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware для обработки ошибок multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Demasiados archivos. Máximo 8 imágenes' });
    }
    return res.status(400).json({ error: 'Error al subir archivos: ' + err.message });
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Solo se permiten archivos de imagen (JPG, PNG, WebP)' });
  }
  next(err);
};

// Получить или создать пользователя
async function getOrCreateUser(telegramId, username, firstName, lastName) {
  const client = await pool.connect();
  try {
    let result = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (result.rows.length === 0) {
      result = await client.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [telegramId, username, firstName, lastName]
      );
    }
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Получить список объявлений с фильтрами
router.get('/', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const {
      category,
      city = 'La Habana',
      neighborhood,
      scope,
      minPrice,
      maxPrice,
      search,
      status = 'active',
      limit = 50,
      offset = 0,
      // Фильтры для квартир
      rooms,
      totalArea,
      livingArea,
      floor,
      floorFrom,
      renovation,
      furniture,
      appliances,
      internet
    } = req.query;
    
    let query = `
      SELECT 
        l.*,
        u.telegram_id,
        u.username,
        u.first_name,
        ARRAY_AGG(lp.photo_url ORDER BY lp.photo_order) FILTER (WHERE lp.photo_url IS NOT NULL) as photos
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN listing_photos lp ON l.id = lp.listing_id
      WHERE l.status = $1
    `;
    
    const params = [status];
    let paramIndex = 2;
    
    if (category) {
      query += ` AND l.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (city && city !== 'all') {
      query += ` AND (l.city = $${paramIndex} OR l.scope = 'COUNTRY')`;
      params.push(city);
      paramIndex++;
    }
    
    if (neighborhood) {
      query += ` AND (l.neighborhood = $${paramIndex} OR l.scope IN ('CITY', 'COUNTRY'))`;
      params.push(neighborhood);
      paramIndex++;
    }
    
    if (scope) {
      query += ` AND l.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    
    if (minPrice) {
      query += ` AND (l.price >= $${paramIndex} OR l.is_negotiable = true)`;
      params.push(parseFloat(minPrice));
      paramIndex++;
    }
    
    if (maxPrice) {
      query += ` AND (l.price <= $${paramIndex} OR l.is_negotiable = true)`;
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (l.title ILIKE $${paramIndex} OR l.description ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    // Фильтры для квартир (пока фильтруем по описанию, так как полей в БД еще нет)
    if (category === 'rent') {
      // Фильтры для квартир (теперь используем поля БД)
      if (rooms) {
        query += ` AND l.rooms = $${paramIndex}`;
        params.push(rooms);
        paramIndex++;
      }
      
      if (totalArea) {
        query += ` AND l.total_area >= $${paramIndex}`;
        params.push(parseFloat(totalArea));
        paramIndex++;
      }
      
      if (livingArea) {
        query += ` AND l.living_area >= $${paramIndex}`;
        params.push(parseFloat(livingArea));
        paramIndex++;
      }
      
      if (floor && floorFrom) {
        query += ` AND l.floor = $${paramIndex} AND l.floor_from = $${paramIndex + 1}`;
        params.push(parseInt(floor), parseInt(floorFrom));
        paramIndex += 2;
      } else if (floor) {
        query += ` AND l.floor = $${paramIndex}`;
        params.push(parseInt(floor));
        paramIndex++;
      }
      
      if (renovation) {
        query += ` AND l.renovation = $${paramIndex}`;
        params.push(renovation);
        paramIndex++;
      }
      
      if (furniture) {
        query += ` AND l.furniture = $${paramIndex}`;
        params.push(furniture);
        paramIndex++;
      }
      
      if (appliances) {
        query += ` AND l.appliances = $${paramIndex}`;
        params.push(appliances);
        paramIndex++;
      }
      
      if (internet) {
        query += ` AND l.internet = $${paramIndex}`;
        params.push(internet);
        paramIndex++;
      }
    }
    
    query += ` GROUP BY l.id, u.telegram_id, u.username, u.first_name`;
    
    // Сортировка: сначала закрепленные, потом продвинутые, потом по дате
    query += ` ORDER BY l.is_pinned DESC, l.is_promoted DESC, l.created_at DESC`;
    
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      listings: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить одно объявление
router.get('/:id', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        l.*,
        u.telegram_id,
        u.username,
        u.first_name,
        ARRAY_AGG(lp.photo_url ORDER BY lp.photo_order) FILTER (WHERE lp.photo_url IS NOT NULL) as photos
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN listing_photos lp ON l.id = lp.listing_id
      WHERE l.id = $1
      GROUP BY l.id, u.telegram_id, u.username, u.first_name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать объявление
router.post('/', optionalAuthenticateTelegram, upload.array('photos', 8), handleMulterError, async (req, res) => {
  try {
    // В режиме разработки разрешаем создавать объявления без Telegram аутентификации
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let telegramUser = req.telegramUser;
    
    // Если нет Telegram пользователя в dev режиме, создаем тестового
    if (!telegramUser && isDevelopment) {
      telegramUser = {
        id: 123456789, // Тестовый ID
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User'
      };
      console.log('⚠️  Development mode: Using test user for listing creation');
    }
    
    if (!telegramUser || !telegramUser.id) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const {
      category,
      scope,
      city = 'La Habana',
      neighborhood,
      title,
      description,
      price,
      currency = 'CUP',
      is_negotiable,
      // Аренда
      rent_type,
      rent_period,
      available_from,
      is_available_now,
      landmark,
      // Дополнительные поля для квартир
      rooms,
      total_area,
      living_area,
      floor,
      floor_from,
      renovation,
      furniture,
      appliances,
      internet,
      // Личные вещи
      item_subcategory,
      item_condition,
      item_brand,
      delivery_type,
      // Услуги
      service_subcategory,
      service_format,
      service_area,
      contact_telegram,
      contact_whatsapp
    } = req.body;
    
    // Валидация обязательных полей
    if (!category || !scope || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Валидация scope по категории
    if (category === 'rent' && scope === 'COUNTRY') {
      return res.status(400).json({ error: 'Rent listings cannot have COUNTRY scope' });
    }
    
    const userId = await getOrCreateUser(
      telegramUser.id,
      telegramUser.username,
      telegramUser.first_name,
      telegramUser.last_name
    );
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const listingResult = await client.query(`
        INSERT INTO listings (
          user_id, category, scope, city, neighborhood, title, description,
          price, currency, is_negotiable,
          rent_type, rent_period, available_from, is_available_now, landmark,
          rooms, total_area, living_area, floor, floor_from, renovation, furniture, appliances, internet,
          item_subcategory, item_condition, item_brand, delivery_type,
          service_subcategory, service_format, service_area,
          contact_telegram, contact_whatsapp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
        RETURNING id
      `, [
        userId, category, scope, city, neighborhood || null, title, description,
        price ? parseFloat(price) : null, currency, is_negotiable === 'true',
        rent_type || null, rent_period || null, available_from || null, is_available_now !== 'false',
        landmark || null,
        rooms || null, 
        total_area ? parseFloat(total_area) : null, 
        living_area ? parseFloat(living_area) : null, 
        floor ? parseInt(floor) : null, 
        floor_from ? parseInt(floor_from) : null, 
        renovation || null, 
        furniture || null, 
        appliances || null, 
        internet || null,
        item_subcategory || null, item_condition || null, item_brand || null, delivery_type || null,
        service_subcategory || null, service_format || null, service_area || null,
        contact_telegram || telegramUser.username || null,
        contact_whatsapp || null
      ]);
      
      const listingId = listingResult.rows[0].id;
      
      // Сохранение фотографий
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const photoUrl = `/uploads/${req.files[i].filename}`;
          await client.query(
            'INSERT INTO listing_photos (listing_id, photo_url, photo_order) VALUES ($1, $2, $3)',
            [listingId, photoUrl, i]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Получаем созданное объявление
      const newListing = await pool.query(`
        SELECT 
          l.*,
          u.telegram_id,
          u.username,
          u.first_name,
          ARRAY_AGG(lp.photo_url ORDER BY lp.photo_order) FILTER (WHERE lp.photo_url IS NOT NULL) as photos
        FROM listings l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN listing_photos lp ON l.id = lp.listing_id
        WHERE l.id = $1
        GROUP BY l.id, u.telegram_id, u.username, u.first_name
      `, [listingId]);
      
      res.status(201).json(newListing.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating listing:', error);
    console.error('Error stack:', error.stack);
    
    // Если ошибка базы данных
    if (error.code && error.code.startsWith('23')) {
      return res.status(400).json({ error: 'Error de validación: ' + error.message });
    }
    
    // Если ошибка подключения к БД
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({ error: 'Error de conexión a la base de datos' });
    }
    
    // Общая ошибка - всегда возвращаем JSON
    const errorMessage = error.message || 'Error interno del servidor';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Обновить статус объявления
router.patch('/:id/status', optionalAuthenticateTelegram, async (req, res) => {
  try {
    if (!req.telegramUser) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const { id } = req.params;
    const { status } = req.body;
    
    // Проверяем, что пользователь является владельцем объявления
    const listing = await pool.query(
      'SELECT l.*, u.telegram_id FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1',
      [id]
    );
    
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    if (listing.rows[0].telegram_id !== req.telegramUser.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
      'UPDATE listings SET status = $1 WHERE id = $2',
      [status, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating listing status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Продвинуть объявление
router.post('/:id/promote', optionalAuthenticateTelegram, async (req, res) => {
  try {
    if (!req.telegramUser) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const { id } = req.params;
    const { type } = req.body; // 'promote', 'pin', 'vip'
    
    // В MVP статус выставляется вручную через админку
    // Здесь просто возвращаем инструкции
    res.json({
      message: 'Для продвижения объявления свяжитесь с администратором',
      contact: '@admin'
    });
  } catch (error) {
    console.error('Error promoting listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




