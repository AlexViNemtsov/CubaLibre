const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken);
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@CubaClasificados';

function normalizeTelegramChatId(value) {
  const raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw) return '@CubaClasificados';
  // numeric chat id like -100123...
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith('@')) return raw;
  return `@${raw}`;
}

// Проверка подписки на канал
router.post('/check', async (req, res) => {
  try {
    let { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Убеждаемся, что userId - это число (Telegram API требует число)
    userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (isNaN(userId)) {
      console.error('Invalid userId format:', req.body.userId);
      // Разрешаем доступ если userId невалидный (чтобы не блокировать пользователей)
      return res.json({ 
        subscribed: true,
        channel: REQUIRED_CHANNEL,
        warning: 'Invalid user ID format, access granted'
      });
    }
    
    try {
      // Формируем chatId правильно (поддержка @username и -100... id)
      const chatId = normalizeTelegramChatId(REQUIRED_CHANNEL);

      console.log('Checking subscription:', { chatId, userId, userIdType: typeof userId });

      const member = await bot.getChatMember(chatId, userId);

      // Статусы: 'member', 'administrator', 'creator' - подписан
      const isSubscribed =
        member.status === 'member' ||
        member.status === 'administrator' ||
        member.status === 'creator';

      console.log('Subscription check result:', {
        userId,
        status: member.status,
        isSubscribed
      });

      return res.json({
        subscribed: isSubscribed,
        channel: REQUIRED_CHANNEL
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.body,
        statusCode: error.response?.statusCode
      });

      // Если канал не найден/бот не админ/бот не в канале — НЕ можем проверить, блокируем с понятной ошибкой
      if (error.response) {
        const statusCode = error.response.statusCode || error.response.status;
        const errorBody = error.response.body || error.response;
        
        console.error('Telegram API Error:', {
          statusCode,
          description: errorBody?.description || errorBody?.message
        });

        if (statusCode === 400 || statusCode === 403) {
          return res.status(200).json({
            subscribed: false,
            channel: REQUIRED_CHANNEL,
            error:
              'No se pudo verificar la suscripción. Asegúrate de que el bot sea administrador del canal e inténtalo de nuevo.'
          });
        }
      }

      // Любая другая ошибка — блокируем с понятной ошибкой
      return res.status(200).json({
        subscribed: false,
        channel: REQUIRED_CHANNEL,
        error: `Error al verificar la suscripción: ${error.message || 'desconocido'}`
      });
    }
  } catch (error) {
    console.error('Error in subscription check:', error);
    // При критической ошибке — блокируем
    return res.status(200).json({
      subscribed: false,
      channel: REQUIRED_CHANNEL,
      error: 'Error interno al verificar la suscripción. Intenta de nuevo más tarde.'
    });
  }
});

module.exports = router;
