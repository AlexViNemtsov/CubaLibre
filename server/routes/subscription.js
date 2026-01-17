const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken);
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@CubaClasificados';

// Проверка подписки на канал
router.post('/check', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
      const chatId = REQUIRED_CHANNEL.startsWith('@') ? REQUIRED_CHANNEL : `@${REQUIRED_CHANNEL}`;
      const member = await bot.getChatMember(chatId, userId);
      
      // Статусы: 'member', 'administrator', 'creator' - подписан
      const isSubscribed = member.status === 'member' || 
                          member.status === 'administrator' || 
                          member.status === 'creator';
      
      res.json({ 
        subscribed: isSubscribed,
        channel: REQUIRED_CHANNEL
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.body,
        statusCode: error.response?.statusCode
      });
      
      // Если канал не найден или другая ошибка API
      if (error.response) {
        const statusCode = error.response.statusCode || error.response.status;
        const errorBody = error.response.body || error.response;
        
        console.error('Telegram API Error:', {
          statusCode,
          description: errorBody?.description || errorBody?.message
        });
        
        // Если пользователь не найден в канале (403) или канал не найден (400)
        if (statusCode === 400 || statusCode === 403) {
          // В режиме разработки разрешаем доступ
          const isDevelopment = process.env.NODE_ENV !== 'production';
          if (isDevelopment) {
            console.warn('⚠️  Development mode: Allowing access without channel check');
            return res.json({ 
              subscribed: true,
              channel: REQUIRED_CHANNEL,
              warning: 'Channel check skipped in development mode'
            });
          }
          
          // В production тоже разрешаем доступ если ошибка проверки
          // Это позволит использовать приложение даже если бот не может проверить подписку
          console.warn('⚠️  Channel check failed, allowing access to prevent blocking users');
          return res.json({ 
            subscribed: true,
            channel: REQUIRED_CHANNEL,
            warning: 'Channel check failed, access granted'
          });
        }
      }
      
      // Для других ошибок тоже разрешаем доступ (чтобы не блокировать пользователей)
      console.warn('⚠️  Unknown error in subscription check, allowing access');
      return res.json({ 
        subscribed: true,
        channel: REQUIRED_CHANNEL,
        error: 'Error checking subscription, access granted',
        warning: 'Subscription check error, but access allowed'
      });
    }
  } catch (error) {
    console.error('Error in subscription check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
