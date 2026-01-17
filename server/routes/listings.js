const express = require('express');
const router = express.Router();
const { pool } = require('../database/init');
const { optionalAuthenticateTelegram } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
  let client;
  try {
    client = await pool.connect();
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
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Получить список объявлений с фильтрами
router.get('/', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const {
      category,
      city,
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
    
    // Если запрашиваются объявления текущего пользователя
    const isMyListings = req.query.my === 'true';
    
    // В режиме разработки разрешаем использовать тестового пользователя
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let telegramUser = req.telegramUser;
    
    if (isMyListings) {
      // Если запрашиваются "мои объявления", нужна аутентификация
      if (!telegramUser && isDevelopment) {
        // В dev режиме используем тестового пользователя
        telegramUser = {
          id: 123456789,
          username: 'test_user',
          first_name: 'Test',
          last_name: 'User'
        };
        console.log('⚠️  Development mode: Using test user for my listings');
      }
      
      if (!telegramUser || !telegramUser.id) {
        return res.status(401).json({ error: 'Telegram authentication required for my listings' });
      }
    }
    
    const statusFilter = isMyListings ? (req.query.status || 'active') : status;
    
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
    
    const params = [statusFilter];
    let paramIndex = 2;
    
    // Если запрашиваются объявления текущего пользователя
    if (isMyListings && telegramUser && telegramUser.id) {
      query += ` AND u.telegram_id = $${paramIndex}`;
      params.push(telegramUser.id);
      paramIndex++;
    }
    
    if (category) {
      query += ` AND l.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (city && city !== 'all' && city !== '') {
      // Для недвижимости не показываем объявления с scope=COUNTRY
      // Поддерживаем точное совпадение по ID города
      if (category === 'rent') {
        query += ` AND l.city = $${paramIndex}`;
      } else {
        // Для других категорий показываем и объявления с scope=COUNTRY
        query += ` AND (l.city = $${paramIndex} OR l.scope = 'COUNTRY')`;
      }
      params.push(city);
      paramIndex++;
    }
    // Если город не указан или 'all', показываем все объявления (без фильтра по городу)
    
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
    // Фильтрация по типу транзакции (аренда/продажа)
    if (category === 'rent' && req.query.has_rent_period) {
      if (req.query.has_rent_period === 'true') {
        // Только объявления с rent_period (аренда)
        query += ` AND l.rent_period IS NOT NULL AND l.rent_period != ''`;
      } else if (req.query.has_rent_period === 'false') {
        // Только объявления без rent_period (продажа)
        query += ` AND (l.rent_period IS NULL OR l.rent_period = '')`;
      }
    }
    
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
    
    console.log('Executing query for my listings:', isMyListings);
    console.log('Query:', query.substring(0, 200) + '...');
    console.log('Params count:', params.length);
    
    const result = await pool.query(query, params);
    
    res.json({
      listings: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Получить одно объявление
router.get('/:id', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Увеличиваем счетчик просмотров
    await pool.query(`
      UPDATE listings 
      SET views = COALESCE(views, 0) + 1 
      WHERE id = $1
    `, [id]);
    
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
router.post('/', optionalAuthenticateTelegram, upload.array('photos', 5), handleMulterError, async (req, res) => {
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
    
    // Валидация длины заголовка (максимум 100 символов)
    if (title && title.length > 100) {
      return res.status(400).json({ error: 'El título es demasiado largo. Máximo 100 caracteres' });
    }
    
    // Валидация: минимум 1 фото обязательно (только при создании нового объявления)
    // При редактировании проверка будет ниже, так как могут быть существующие фото
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Por favor, agrega al menos una fotografía' });
    }
    
    // Валидация цены: цена обязательна для всех категорий (либо указана цена, либо is_negotiable = true)
    if (!price && is_negotiable !== 'true' && is_negotiable !== true) {
      return res.status(400).json({ error: 'Price is required. Please specify price or mark as negotiable' });
    }
    
    // Проверка на максимальное количество активных объявлений от одного пользователя (максимум 10)
    const activeListingsCheck = await pool.query(
      `SELECT COUNT(*) as count FROM listings l 
       JOIN users u ON l.user_id = u.id 
       WHERE u.telegram_id = $1 AND l.status = 'active'`,
      [telegramUser.id]
    );
    
    const activeCount = parseInt(activeListingsCheck.rows[0].count);
    if (activeCount >= 10) {
      return res.status(400).json({ 
        error: 'Has alcanzado el límite de 10 anuncios activos. Por favor, completa o elimina algunos anuncios antes de publicar nuevos.' 
      });
    }
    
    // Проверка на дубляжи объявлений (похожие заголовок и описание от того же пользователя)
    const duplicateCheck = await pool.query(
      `SELECT l.id FROM listings l 
       JOIN users u ON l.user_id = u.id 
       WHERE u.telegram_id = $1 
       AND LOWER(TRIM(l.title)) = LOWER(TRIM($2))
       AND LOWER(TRIM(l.description)) = LOWER(TRIM($3))
       AND l.status = 'active'
       LIMIT 1`,
      [telegramUser.id, title.trim(), description.trim()]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Ya tienes un anuncio activo con el mismo título y descripción. Por favor, edita el anuncio existente o usa un título/descripción diferente.' 
      });
    }
    
    // Проверка на дубляжи по фотографиям (если есть загруженные фотографии)
    if (req.files && req.files.length > 0) {
      // Вычисляем хеши загруженных фотографий
      const newPhotoHashes = [];
      for (const file of req.files) {
        const fileBuffer = fs.readFileSync(file.path);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        newPhotoHashes.push(hash);
      }
      
      // Получаем все активные объявления пользователя с их фотографиями
      const userListingsResult = await pool.query(
        `SELECT l.id, lp.photo_url 
         FROM listings l
         JOIN users u ON l.user_id = u.id
         LEFT JOIN listing_photos lp ON l.id = lp.listing_id
         WHERE u.telegram_id = $1 AND l.status = 'active'`,
        [telegramUser.id]
      );
      
      // Группируем фотографии по объявлениям
      const listingsWithPhotos = {};
      for (const row of userListingsResult.rows) {
        if (!listingsWithPhotos[row.id]) {
          listingsWithPhotos[row.id] = [];
        }
        if (row.photo_url) {
          listingsWithPhotos[row.id].push(row.photo_url);
        }
      }
      
      // Проверяем каждое существующее объявление на совпадение фотографий
      for (const [listingId, photoUrls] of Object.entries(listingsWithPhotos)) {
        if (photoUrls.length === 0) continue;
        
        // Вычисляем хеши существующих фотографий
        const existingPhotoHashes = [];
        for (const photoUrl of photoUrls) {
          const photoPath = photoUrl.startsWith('/uploads') 
            ? path.join(process.env.UPLOAD_DIR || './uploads', photoUrl.replace('/uploads/', ''))
            : photoUrl.replace(/^https?:\/\/[^\/]+/, '');
          
          const fullPath = photoPath.startsWith('/') || photoPath.match(/^[A-Z]:/) 
            ? photoPath 
            : path.join(process.env.UPLOAD_DIR || './uploads', photoPath);
          
          try {
            if (fs.existsSync(fullPath)) {
              const fileBuffer = fs.readFileSync(fullPath);
              const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
              existingPhotoHashes.push(hash);
            }
          } catch (err) {
            // Если файл не найден, пропускаем его
            console.warn(`Warning: Could not read photo file ${fullPath}:`, err.message);
          }
        }
        
        // Если количество фотографий совпадает, сравниваем хеши
        if (existingPhotoHashes.length === newPhotoHashes.length && existingPhotoHashes.length > 0) {
          // Сортируем хеши для сравнения (порядок фотографий не важен)
          const sortedExisting = [...existingPhotoHashes].sort();
          const sortedNew = [...newPhotoHashes].sort();
          
          // Проверяем, все ли хеши совпадают
          const allMatch = sortedExisting.every((hash, index) => hash === sortedNew[index]);
          
          if (allMatch) {
            // Удаляем загруженные файлы, так как это дубль
            for (const file of req.files) {
              try {
                if (fs.existsSync(file.path)) {
                  fs.unlinkSync(file.path);
                }
              } catch (err) {
                console.warn(`Warning: Could not delete duplicate photo file ${file.path}:`, err.message);
              }
            }
            
            return res.status(400).json({ 
              error: 'Ya tienes un anuncio activo con las mismas fotografías. Por favor, edita el anuncio existente o usa fotografías diferentes.' 
            });
          }
        }
      }
    }
    
    // Валидация для недвижимости: город обязателен и scope не может быть COUNTRY
    if (category === 'rent') {
      if (!city || city === 'all') {
        return res.status(400).json({ error: 'City is required for rent listings' });
      }
      if (scope === 'COUNTRY') {
        return res.status(400).json({ error: 'Rent listings cannot have COUNTRY scope' });
      }
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
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Если ошибка базы данных
    if (error.code && error.code.startsWith('23')) {
      return res.status(400).json({ error: 'Error de validación: ' + error.message });
    }
    
    // Если ошибка подключения к БД
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
        error.code === '28P01' || error.code === '3D000' || error.code === '57P01' ||
        error.code === '57P02' || error.code === '57P03' ||
        (error.message && (error.message.includes('connection') || error.message.includes('database') || 
         error.message.includes('timeout') || error.message.includes('ECONNREFUSED')))) {
      console.error('❌ Database connection error:', {
        code: error.code,
        message: error.message,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      });
      return res.status(500).json({ 
        error: 'Error de conexión a la base de datos. Por favor, intenta de nuevo en unos momentos.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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
    // В режиме разработки разрешаем использовать тестового пользователя
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let telegramUser = req.telegramUser;
    
    if (!telegramUser && isDevelopment) {
      telegramUser = {
        id: 123456789,
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User'
      };
      console.log('⚠️  Development mode: Using test user for status update');
    }
    
    if (!telegramUser || !telegramUser.id) {
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
    
    // В режиме разработки пропускаем проверку владельца
    if (!isDevelopment && listing.rows[0].telegram_id !== telegramUser.id) {
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

// Редактировать объявление
router.put('/:id', optionalAuthenticateTelegram, upload.array('photos', 5), handleMulterError, async (req, res) => {
  try {
    // В режиме разработки разрешаем редактировать объявления без Telegram аутентификации
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
      console.log('⚠️  Development mode: Using test user for listing update');
    }
    
    if (!telegramUser || !telegramUser.id) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const { id } = req.params;
    
    // Проверяем, что пользователь является владельцем объявления
    const listingCheck = await pool.query(
      'SELECT l.*, u.telegram_id FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1',
      [id]
    );
    
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // В dev режиме пропускаем проверку владельца
    if (!isDevelopment && listingCheck.rows[0].telegram_id !== telegramUser.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const {
      category,
      scope,
      city,
      neighborhood,
      title,
      description,
      price,
      currency,
      is_negotiable,
      rent_type,
      rent_period,
      available_from,
      is_available_now,
      landmark,
      rooms,
      total_area,
      living_area,
      floor,
      floor_from,
      renovation,
      furniture,
      appliances,
      internet,
      item_subcategory,
      item_condition,
      item_brand,
      delivery_type,
      service_subcategory,
      service_format,
      service_area,
      contact_telegram,
      contact_whatsapp,
      delete_photos // массив ID или URL фотографий для удаления
    } = req.body;
    
    // Обработка delete_photos из FormData (может быть массивом или объектом с индексами)
    let photosToDelete = [];
    if (delete_photos) {
      if (Array.isArray(delete_photos)) {
        photosToDelete = delete_photos;
      } else if (typeof delete_photos === 'object') {
        // Если это объект с индексами (delete_photos[0], delete_photos[1], ...)
        photosToDelete = Object.values(delete_photos);
      } else {
        photosToDelete = [delete_photos];
      }
    }
    
    // Валидация для недвижимости при редактировании
    const currentCategory = category || listingCheck.rows[0].category;
    const newScope = scope || listingCheck.rows[0].scope;
    const newCity = city || listingCheck.rows[0].city;
    
    if (currentCategory === 'rent') {
      if (newScope === 'COUNTRY') {
        return res.status(400).json({ error: 'Rent listings cannot have COUNTRY scope' });
      }
      if (!newCity || newCity === 'all') {
        return res.status(400).json({ error: 'City is required for rent listings' });
      }
    }
    
    // Валидация: минимум 1 фото обязательно при редактировании
    // Проверяем количество существующих фото после удаления и новых фото
    const existingPhotosCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM listing_photos WHERE listing_id = $1',
      [id]
    );
    const currentPhotosCount = parseInt(existingPhotosCountResult.rows[0].count);
    const photosToDeleteCount = photosToDelete.length;
    const newPhotosCount = req.files ? req.files.length : 0;
    const totalPhotosAfterEdit = currentPhotosCount - photosToDeleteCount + newPhotosCount;
    
    if (totalPhotosAfterEdit < 1) {
      return res.status(400).json({ error: 'El anuncio debe tener al menos una fotografía' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Обновляем основную информацию объявления
      await client.query(`
        UPDATE listings SET
          category = COALESCE($1, category),
          scope = COALESCE($2, scope),
          city = COALESCE($3, city),
          neighborhood = COALESCE($4, neighborhood),
          title = COALESCE($5, title),
          description = COALESCE($6, description),
          price = COALESCE($7::DECIMAL, price),
          currency = COALESCE($8, currency),
          is_negotiable = COALESCE($9::BOOLEAN, is_negotiable),
          rent_type = COALESCE($10, rent_type),
          rent_period = COALESCE($11, rent_period),
          available_from = COALESCE($12::DATE, available_from),
          is_available_now = COALESCE($13::BOOLEAN, is_available_now),
          landmark = COALESCE($14, landmark),
          rooms = COALESCE($15, rooms),
          total_area = COALESCE($16::DECIMAL, total_area),
          living_area = COALESCE($17::DECIMAL, living_area),
          floor = COALESCE($18::INTEGER, floor),
          floor_from = COALESCE($19::INTEGER, floor_from),
          renovation = COALESCE($20, renovation),
          furniture = COALESCE($21, furniture),
          appliances = COALESCE($22, appliances),
          internet = COALESCE($23, internet),
          item_subcategory = COALESCE($24, item_subcategory),
          item_condition = COALESCE($25, item_condition),
          item_brand = COALESCE($26, item_brand),
          delivery_type = COALESCE($27, delivery_type),
          service_subcategory = COALESCE($28, service_subcategory),
          service_format = COALESCE($29, service_format),
          service_area = COALESCE($30, service_area),
          contact_telegram = COALESCE($31, contact_telegram),
          contact_whatsapp = COALESCE($32, contact_whatsapp)
        WHERE id = $33
      `, [
        category, scope, city, neighborhood, title, description,
        price, currency, is_negotiable,
        rent_type, rent_period, available_from, is_available_now, landmark,
        rooms, total_area, living_area, floor, floor_from,
        renovation, furniture, appliances, internet,
        item_subcategory, item_condition, item_brand, delivery_type,
        service_subcategory, service_format, service_area,
        contact_telegram, contact_whatsapp,
        id
      ]);
      
      // Удаляем указанные фотографии
      if (photosToDelete.length > 0) {
        for (const photoIdentifier of photosToDelete) {
          let photoResult;
          
          // Пытаемся найти фотографию по ID (если это число)
          if (!isNaN(photoIdentifier)) {
            photoResult = await client.query(
              'SELECT photo_url FROM listing_photos WHERE id = $1 AND listing_id = $2',
              [parseInt(photoIdentifier), id]
            );
          } else {
            // Ищем по URL фотографии
            const photoUrl = photoIdentifier.startsWith('/uploads') 
              ? photoIdentifier 
              : photoIdentifier.replace(/^https?:\/\/[^\/]+/, '');
            photoResult = await client.query(
              'SELECT photo_url FROM listing_photos WHERE photo_url = $1 AND listing_id = $2',
              [photoUrl, id]
            );
          }
          
          if (photoResult.rows.length > 0) {
            const photoPath = photoResult.rows[0].photo_url;
            // Удаляем файл
            const fs = require('fs');
            const path = require('path');
            const uploadDir = process.env.UPLOAD_DIR || './uploads';
            const fullPath = path.join(uploadDir, photoPath.replace('/uploads/', ''));
            try {
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
              }
            } catch (err) {
              console.warn('Error deleting photo file:', err.message);
            }
            // Удаляем запись из БД по URL
            await client.query('DELETE FROM listing_photos WHERE photo_url = $1 AND listing_id = $2', [photoPath, id]);
          }
        }
      }
      
      // Добавляем новые фотографии
      if (req.files && req.files.length > 0) {
        const maxOrder = await client.query(
          'SELECT COALESCE(MAX(photo_order), -1) as max_order FROM listing_photos WHERE listing_id = $1',
          [id]
        );
        let nextOrder = (maxOrder.rows[0].max_order || -1) + 1;
        
        for (let i = 0; i < req.files.length; i++) {
          const photoUrl = `/uploads/${req.files[i].filename}`;
          await client.query(
            'INSERT INTO listing_photos (listing_id, photo_url, photo_order) VALUES ($1, $2, $3)',
            [id, photoUrl, nextOrder++]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Получаем обновленное объявление
      const updatedListing = await pool.query(`
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
      
      res.json(updatedListing.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить объявление
router.delete('/:id', optionalAuthenticateTelegram, async (req, res) => {
  try {
    // В режиме разработки разрешаем удалять объявления без Telegram аутентификации
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
      console.log('⚠️  Development mode: Using test user for listing deletion');
    }
    
    if (!telegramUser || !telegramUser.id) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const { id } = req.params;
    
    // Проверяем, что пользователь является владельцем объявления
    const listing = await pool.query(
      'SELECT l.*, u.telegram_id FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1',
      [id]
    );
    
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // В dev режиме пропускаем проверку владельца
    if (!isDevelopment && listing.rows[0].telegram_id !== telegramUser.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Удаляем фотографии
      const photos = await client.query(
        'SELECT photo_url FROM listing_photos WHERE listing_id = $1',
        [id]
      );
      
      const fs = require('fs');
      const path = require('path');
      for (const photo of photos.rows) {
        const photoPath = photo.photo_url;
        const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', photoPath.replace('/uploads/', ''));
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      // Удаляем записи о фотографиях
      await client.query('DELETE FROM listing_photos WHERE listing_id = $1', [id]);
      
      // Удаляем объявление (каскадное удаление через user_id)
      await client.query('DELETE FROM listings WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting listing:', error);
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




