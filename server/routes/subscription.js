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
      
      // Если канал не найден или другая ошибка API
      if (error.response && error.response.statusCode === 400) {
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
      }
      
      return res.status(500).json({ 
        error: 'Error checking subscription',
        subscribed: false,
        channel: REQUIRED_CHANNEL
      });
    }
  } catch (error) {
    console.error('Error in subscription check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
