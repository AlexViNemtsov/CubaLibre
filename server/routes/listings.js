const express = require('express');
const router = express.Router();
const { pool } = require('../database/init');
const authMiddleware = require('../middleware/auth');
const { optionalAuthenticateTelegram } = authMiddleware;
const isAdmin = authMiddleware.isAdmin || function(telegramUserId) {
  // Fallback функция, если isAdmin не экспортирована
  if (!telegramUserId) return false;
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const adminIds = process.env.TELEGRAM_ADMIN_IDS;
  if (adminId && String(telegramUserId) === String(adminId)) {
    return true;
  }
  if (adminIds) {
    const adminIdList = adminIds.split(',').map(id => id.trim());
    return adminIdList.includes(String(telegramUserId));
  }
  return false;
};
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

// Функция для отправки уведомления администратору о новом пользователе
async function notifyAdminAboutNewUser(telegramId, username, firstName, lastName) {
  try {
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (!adminId) {
      console.log('ℹ️ TELEGRAM_ADMIN_ID not set, skipping admin notification');
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('ℹ️ TELEGRAM_BOT_TOKEN not set, skipping admin notification');
      return;
    }

    // Создаем отдельный экземпляр бота для отправки уведомлений
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(botToken);

    const userInfo = [
      `👤 Новый пользователь начал работу с приложением!`,
      ``,
      `🆔 ID: ${telegramId}`,
      `👤 Имя: ${firstName || 'Не указано'} ${lastName || ''}`,
      `📱 Username: @${username || 'не указан'}`,
      `⏰ Время: ${new Date().toLocaleString('ru-RU')}`
    ].join('\n');

    await bot.sendMessage(adminId, userInfo);
    console.log('✅ Admin notification sent about new user:', telegramId);
  } catch (error) {
    console.error('❌ Error sending admin notification:', error.message);
    // Не прерываем выполнение, если уведомление не отправилось
  }
}

// Получить или создать пользователя
async function getOrCreateUser(telegramId, username, firstName, lastName) {
  let client;
  try {
    // Убеждаемся, что telegramId - это число (BIGINT в БД)
    const telegramIdNum = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
    
    client = await pool.connect();
    let result = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramIdNum]
    );
    
    const isNewUser = result.rows.length === 0;
    
    if (isNewUser) {
      result = await client.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [telegramIdNum, username, firstName, lastName]
      );
      console.log('✅ Created new user:', { telegram_id: telegramIdNum, username });
      
      // Отправляем уведомление администратору о новом пользователе
      await notifyAdminAboutNewUser(telegramIdNum, username, firstName, lastName);
    } else {
      console.log('✅ Found existing user:', { telegram_id: telegramIdNum, user_id: result.rows[0].id });
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
    
    // Логируем примеры URL фото для отладки
    if (result.rows.length > 0) {
      const sampleListing = result.rows[0];
      if (sampleListing.photos && sampleListing.photos.length > 0) {
        console.log('📸 Sample photo URLs from DB:', {
          listingId: sampleListing.id,
          photos: sampleListing.photos.slice(0, 2) // Первые 2 фото
        });
      }
    }
    
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

// Проверить, является ли пользователь администратором (должен быть ПЕРЕД /:id)
router.get('/check-admin', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const telegramUser = req.telegramUser;
    
    if (!telegramUser || !telegramUser.id) {
      return res.json({ isAdmin: false });
    }
    
    const adminStatus = isAdmin(telegramUser.id);
    res.json({ isAdmin: adminStatus });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.json({ isAdmin: false });
  }
});

// Получить одно объявление
router.get('/:id', optionalAuthenticateTelegram, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Защита: если id не число, это не объявление
    if (isNaN(parseInt(id, 10))) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
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
    
    const listing = result.rows[0];
    
    // Логируем URL фото для отладки
    if (listing.photos && listing.photos.length > 0) {
      console.log('📸 Photo URLs for listing:', {
        listingId: listing.id,
        photos: listing.photos
      });
    }
    
    res.json(listing);
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
    
    // Если таблица не существует - это критическая ошибка инициализации БД
    if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('❌ CRITICAL: Database table does not exist. Attempting to force create tables...');
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        table: error.message.match(/relation "(\w+)" does not exist/)?.[1]
      });
      
      // Пытаемся принудительно создать таблицы
      const { forceCreateTables } = require('../database/init');
      try {
        console.log('🔄 Starting force table creation...');
        await forceCreateTables();
        console.log('✅ Force table creation completed');
        
        // Проверяем, что таблица теперь существует
        const verifyCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'listings'
          );
        `);
        
        if (verifyCheck.rows[0].exists) {
          console.log('✅ Database tables verified. Tables exist now.');
          // Возвращаем сообщение, что нужно повторить попытку
          return res.status(503).json({ 
            error: 'La base de datos se está inicializando. Por favor, intenta de nuevo en unos segundos.',
            retry: true,
            details: process.env.NODE_ENV === 'development' ? 'Database tables were just created' : undefined
          });
        } else {
          console.error('❌ Tables still do not exist after force creation');
          throw new Error('Tables were not created after force creation');
        }
      } catch (initError) {
        console.error('❌ Failed to force create database tables:', initError.message);
        console.error('Init error code:', initError.code);
        console.error('Init error stack:', initError.stack);
        
        // Пробуем еще раз с упрощенным методом
        try {
          const { createTablesDirectly } = require('../database/init');
          console.log('🔄 Trying createTablesDirectly as last resort...');
          await createTablesDirectly();
          
          const finalCheck = await pool.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'listings'
            );
          `);
          
          if (finalCheck.rows[0].exists) {
            return res.status(503).json({ 
              error: 'La base de datos se está inicializando. Por favor, intenta de nuevo en unos segundos.',
              retry: true
            });
          }
        } catch (lastError) {
          console.error('❌ Last resort table creation also failed:', lastError.message);
        }
        
        return res.status(500).json({ 
          error: 'Error crítico: la base de datos no está configurada correctamente. Por favor, contacta al administrador.',
          details: process.env.NODE_ENV === 'development' ? initError.message : undefined
        });
      }
    }
    
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
    
    // Логируем заголовки и telegramUser для отладки
    console.log('🔍 PATCH /status - Request info:', {
      method: req.method,
      path: req.path,
      hasTelegramUser: !!req.telegramUser,
      telegramUser: req.telegramUser,
      headers: Object.keys(req.headers),
      hasInitDataHeader: !!req.headers['x-telegram-init-data'],
      isDevelopment
    });
    
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
      console.error('❌ PATCH /status - Telegram user not found:', {
        hasTelegramUser: !!req.telegramUser,
        telegramUser: req.telegramUser,
        headers: req.headers
      });
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
    
    // Проверяем права: либо пользователь владелец, либо администратор
    // Логирование для отладки
    const listingTelegramId = listing.rows[0].telegram_id;
    const userTelegramId = telegramUser.id;
    
    // Проверяем, является ли пользователь администратором (с защитой от ошибок)
    let userIsAdmin = false;
    try {
      if (typeof isAdmin === 'function') {
        userIsAdmin = isAdmin(userTelegramId);
      } else {
        console.error('isAdmin is not a function! Type:', typeof isAdmin);
        // Fallback: проверяем напрямую
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        const adminIds = process.env.TELEGRAM_ADMIN_IDS;
        if (adminId && String(userTelegramId) === String(adminId)) {
          userIsAdmin = true;
        } else if (adminIds) {
          const adminIdList = adminIds.split(',').map(id => id.trim());
          userIsAdmin = adminIdList.includes(String(userTelegramId));
        }
      }
    } catch (adminError) {
      console.error('Error checking admin status:', adminError);
      userIsAdmin = false;
    }
    
    console.log('Status update authorization check:', {
      listingId: id,
      listingTelegramId: listingTelegramId,
      listingTelegramIdType: typeof listingTelegramId,
      userTelegramId: userTelegramId,
      userTelegramIdType: typeof userTelegramId,
      isDevelopment: isDevelopment,
      userIsAdmin: userIsAdmin,
      isAdminType: typeof isAdmin,
      match: String(listingTelegramId) === String(userTelegramId)
    });
    
    // Проверяем права: либо пользователь владелец, либо администратор
    // Используем такое же сравнение, как в DELETE маршруте
    const isOwner = String(listingTelegramId) === String(userTelegramId);
    const canUpdate = isDevelopment || isOwner || userIsAdmin;
    
    if (!canUpdate) {
      console.error('Status update authorization failed:', {
        listingTelegramId,
        userTelegramId,
        listingTelegramIdType: typeof listingTelegramId,
        userTelegramIdType: typeof userTelegramId,
        isOwner,
        userIsAdmin,
        isDevelopment,
        stringComparison: String(listingTelegramId) === String(userTelegramId),
        normalizedComparison: listingTelegramId != null && userTelegramId != null && 
                             String(listingTelegramId).trim() === String(userTelegramId).trim()
      });
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
router.put('/:id', optionalAuthenticateTelegram, (req, res, next) => {
  // Логируем ДО обработки файлов
  console.log('🔍 PUT /:id - Request received:', {
    method: req.method,
    path: req.path,
    listingId: req.params.id,
    hasTelegramUser: !!req.telegramUser,
    telegramUser: req.telegramUser,
    contentType: req.headers['content-type']
  });
  next();
}, upload.array('photos', 5), handleMulterError, async (req, res) => {
  try {
    // В режиме разработки разрешаем редактировать объявления без Telegram аутентификации
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let telegramUser = req.telegramUser;
    
    // Логируем заголовки и telegramUser для отладки
    console.log('🔍 PUT /:id - After file upload:', {
      method: req.method,
      path: req.path,
      listingId: req.params.id,
      hasTelegramUser: !!req.telegramUser,
      telegramUser: req.telegramUser,
      filesCount: req.files ? req.files.length : 0,
      headers: Object.keys(req.headers),
      hasInitDataHeader: !!req.headers['x-telegram-init-data'],
      initDataLength: req.headers['x-telegram-init-data']?.length || 0,
      isDevelopment
    });
    
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
      console.error('❌ PUT /:id - Telegram user not found:', {
        hasTelegramUser: !!req.telegramUser,
        telegramUser: req.telegramUser,
        hasInitData: !!req.headers['x-telegram-init-data'],
        headers: Object.keys(req.headers)
      });
      return res.status(401).json({ error: 'Telegram authentication required' });
    }
    
    const { id } = req.params;
    
    // Защита: если id не число, это не объявление
    if (isNaN(parseInt(id, 10))) {
      console.error('❌ PUT /:id - Invalid listing ID:', id);
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    console.log('🔍 PUT /:id - Fetching listing:', id);
    
    // Проверяем, что пользователь является владельцем объявления
    const listingCheck = await pool.query(
      'SELECT l.*, u.telegram_id FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1',
      [id]
    );
    
    console.log('🔍 PUT /:id - Listing check result:', {
      found: listingCheck.rows.length > 0,
      listingId: listingCheck.rows[0]?.id,
      ownerTelegramId: listingCheck.rows[0]?.telegram_id
    });
    
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Проверяем права: либо пользователь владелец, либо администратор
    const listingTelegramId = listingCheck.rows[0].telegram_id;
    const userTelegramId = telegramUser.id;
    
    // Проверяем, является ли пользователь администратором (с защитой от ошибок)
    let userIsAdmin = false;
    try {
      if (typeof isAdmin === 'function') {
        userIsAdmin = isAdmin(userTelegramId);
      } else {
        console.error('isAdmin is not a function! Type:', typeof isAdmin);
        // Fallback: проверяем напрямую
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        const adminIds = process.env.TELEGRAM_ADMIN_IDS;
        if (adminId && String(userTelegramId) === String(adminId)) {
          userIsAdmin = true;
        } else if (adminIds) {
          const adminIdList = adminIds.split(',').map(id => id.trim());
          userIsAdmin = adminIdList.includes(String(userTelegramId));
        }
      }
    } catch (adminError) {
      console.error('Error checking admin status:', adminError);
      userIsAdmin = false;
    }
    
    console.log('Edit authorization check:', {
      listingId: id,
      listingTelegramId: listingTelegramId,
      listingTelegramIdType: typeof listingTelegramId,
      userTelegramId: userTelegramId,
      userTelegramIdType: typeof userTelegramId,
      isDevelopment: isDevelopment,
      userIsAdmin: userIsAdmin,
      isAdminType: typeof isAdmin,
      match: String(listingTelegramId) === String(userTelegramId)
    });
    
    // Используем такое же сравнение, как в DELETE и PATCH маршрутах
    const isOwner = String(listingTelegramId) === String(userTelegramId);
    const canEdit = isDevelopment || isOwner || userIsAdmin;
    
    if (!canEdit) {
      console.error('Edit authorization failed:', {
        listingTelegramId,
        userTelegramId,
        listingTelegramIdType: typeof listingTelegramId,
        userTelegramIdType: typeof userTelegramId,
        isOwner,
        userIsAdmin,
        isDevelopment,
        stringComparison: String(listingTelegramId) === String(userTelegramId),
        normalizedComparison: listingTelegramId != null && userTelegramId != null && 
                             String(listingTelegramId).trim() === String(userTelegramId).trim()
      });
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
    
    // Логирование для отладки
    const listingTelegramId = listing.rows[0].telegram_id;
    const userTelegramId = telegramUser.id;
    
    // Проверяем, является ли пользователь администратором (с защитой от ошибок)
    let userIsAdmin = false;
    try {
      if (typeof isAdmin === 'function') {
        userIsAdmin = isAdmin(userTelegramId);
      } else {
        console.error('isAdmin is not a function! Type:', typeof isAdmin);
        // Fallback: проверяем напрямую
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        const adminIds = process.env.TELEGRAM_ADMIN_IDS;
        if (adminId && String(userTelegramId) === String(adminId)) {
          userIsAdmin = true;
        } else if (adminIds) {
          const adminIdList = adminIds.split(',').map(id => id.trim());
          userIsAdmin = adminIdList.includes(String(userTelegramId));
        }
      }
    } catch (adminError) {
      console.error('Error checking admin status:', adminError);
      userIsAdmin = false;
    }
    
    console.log('Delete authorization check:', {
      listingId: id,
      listingTelegramId: listingTelegramId,
      listingTelegramIdType: typeof listingTelegramId,
      userTelegramId: userTelegramId,
      userTelegramIdType: typeof userTelegramId,
      isDevelopment: isDevelopment,
      userIsAdmin: userIsAdmin,
      isAdminType: typeof isAdmin,
      match: String(listingTelegramId) === String(userTelegramId)
    });
    
    // Проверяем права: либо пользователь владелец, либо администратор
    const isOwner = String(listingTelegramId) === String(userTelegramId);
    const canDelete = isDevelopment || isOwner || userIsAdmin;
    
    if (!canDelete) {
      console.error('Authorization failed:', {
        listingTelegramId,
        userTelegramId,
        isOwner,
        userIsAdmin,
        types: { listing: typeof listingTelegramId, user: typeof userTelegramId }
      });
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Логируем, если администратор удаляет чужое объявление
    if (userIsAdmin && !isOwner) {
      console.log('🔨 Admin deleting listing:', {
        adminId: userTelegramId,
        adminUsername: telegramUser.username,
        listingId: id,
        ownerId: listingTelegramId,
        listingTitle: listing.rows[0].title
      });
      
      // Отправляем уведомление администратору о удалении (опционально)
      try {
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        if (adminId && String(adminId) !== String(userTelegramId)) {
          const TelegramBot = require('node-telegram-bot-api');
          const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
          await bot.sendMessage(adminId, 
            `🔨 Администратор удалил объявление:\n\n` +
            `ID объявления: ${id}\n` +
            `Владелец: @${listing.rows[0].username || 'не указан'} (${listingTelegramId})\n` +
            `Заголовок: ${listing.rows[0].title}\n` +
            `Удалил: @${telegramUser.username || 'не указан'} (${userTelegramId})`
          );
        }
      } catch (notifError) {
        console.error('Error sending admin notification:', notifError.message);
      }
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
        (error.message && (error.message.includes('connection') || error.message.includes('database')))) {
      return res.status(500).json({ 
        error: 'Error de conexión a la base de datos. Por favor, intenta de nuevo en unos momentos.'
      });
    }
    
    // Если таблица не существует
    if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Error: la base de datos no está configurada correctamente. Por favor, contacta al administrador.'
      });
    }
    
    // Общая ошибка
    const errorMessage = error.message || 'Error interno del servidor';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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




