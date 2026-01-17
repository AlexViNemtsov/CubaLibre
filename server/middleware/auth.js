const crypto = require('crypto');

// Проверка подлинности Telegram Web App initData
function verifyTelegramWebAppData(initData, botToken) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    return false;
  }
}

// Middleware для проверки Telegram авторизации
function authenticateTelegram(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  
  if (!initData) {
    return res.status(401).json({ error: 'Telegram initData required' });
  }
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!verifyTelegramWebAppData(initData, botToken)) {
    return res.status(401).json({ error: 'Invalid Telegram initData' });
  }
  
  // Парсим данные пользователя из initData
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (userStr) {
      req.telegramUser = JSON.parse(userStr);
    }
  } catch (error) {
    console.error('Error parsing Telegram user:', error);
  }
  
  next();
}

// Опциональная аутентификация (для публичных endpoints)
function optionalAuthenticateTelegram(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  
  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const isValid = verifyTelegramWebAppData(initData, botToken);
    
    if (isValid) {
      try {
        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        if (userStr) {
          req.telegramUser = JSON.parse(userStr);
          // Убеждаемся, что id - это число (BIGINT в БД)
          if (req.telegramUser.id) {
            req.telegramUser.id = parseInt(req.telegramUser.id, 10);
          }
          console.log('✅ Telegram user authenticated:', {
            id: req.telegramUser.id,
            username: req.telegramUser.username,
            method: req.method,
            path: req.path
          });
        }
      } catch (error) {
        console.error('Error parsing Telegram user:', error);
      }
    } else {
      console.warn('⚠️ Invalid Telegram initData:', {
        method: req.method,
        path: req.path,
        hasInitData: !!initData
      });
    }
  } else {
    console.log('ℹ️ No Telegram initData provided:', {
      method: req.method,
      path: req.path,
      headers: Object.keys(req.headers)
    });
  }
  
  next();
}

module.exports = {
  authenticateTelegram,
  optionalAuthenticateTelegram,
  verifyTelegramWebAppData
};




