const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен в переменных окружения!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://cuba-clasificados.online';
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@CubaClasificados'; // Канал, на который нужно подписаться

// Настройка меню команд
async function setupBotCommands() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Iniciar el bot y abrir la aplicación' },
      { command: 'app', description: 'Abrir la aplicación web' },
      { command: 'help', description: 'Ver ayuda y comandos disponibles' }
    ]);
    console.log('✅ Bot commands menu configured');
  } catch (error) {
    console.error('❌ Error setting bot commands:', error.message);
  }
}

// Настройка меню команд при запуске
setupBotCommands();

// Функция проверки подписки на канал
async function checkChannelSubscription(userId) {
  try {
    const chatId = REQUIRED_CHANNEL.startsWith('@') ? REQUIRED_CHANNEL : `@${REQUIRED_CHANNEL}`;
    const member = await bot.getChatMember(chatId, userId);
    
    // Статусы: 'member', 'administrator', 'creator' - подписан
    // 'left', 'kicked' - не подписан
    return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
  } catch (error) {
    console.error('Error checking channel subscription:', error);
    // Если канал не найден или другая ошибка, разрешаем доступ (для разработки)
    return true;
  }
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  
  // Проверяем подписку на канал
  const isSubscribed = await checkChannelSubscription(userId);
  
  if (!isSubscribed) {
    bot.sendMessage(chatId, `
⚠️ Para usar este bot, necesitas estar suscrito a nuestro canal.

📢 Suscríbete a ${REQUIRED_CHANNEL} para continuar.

Después de suscribirte, usa /start nuevamente.
    `, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: `📢 Suscribirse a ${REQUIRED_CHANNEL}`,
            url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`
          }
        ], [
          {
            text: '🔄 Verificar suscripción',
            callback_data: 'check_subscription'
          }
        ]]
      }
    });
    return;
  }
  
  bot.sendMessage(chatId, `
👋 Hola, ${firstName}!

Bienvenido a Cuba Clasificados — tu tablón de anuncios local.

🏠 Alquiler
👕 Artículos personales  
🛠 Servicios

¡Y ahora entra rápidamente a la aplicación!
  `, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '📱 Abrir aplicación',
          web_app: { url: WEB_APP_URL }
        }
      ]]
    }
  });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Проверяем, является ли пользователь администратором
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const adminIds = process.env.TELEGRAM_ADMIN_IDS;
  
  let isAdmin = false;
  if (adminId && String(userId) === String(adminId)) {
    isAdmin = true;
  } else if (adminIds) {
    const adminIdList = adminIds.split(',').map(id => id.trim());
    isAdmin = adminIdList.includes(String(userId));
  }
  
  let helpText = `
📖 Comandos disponibles:

/start - Iniciar el bot
/help - Ver esta ayuda
/app - Abrir la aplicación

ℹ️ Información:
• Publica anuncios gratis
• Contacta directamente con vendedores
• Optimizado para conexiones lentas
  `;
  
  if (isAdmin) {
    helpText += `\n\n🔨 Команды администратора:\n/delete <ID> - Удалить объявление по ID`;
  }
  
  bot.sendMessage(chatId, helpText);
});

// Команда /app
bot.onText(/\/app/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Проверяем подписку на канал
  const isSubscribed = await checkChannelSubscription(userId);
  
  if (!isSubscribed) {
    bot.sendMessage(chatId, `
⚠️ Para usar la aplicación, necesitas estar suscrito a nuestro canal.

📢 Suscríbete a ${REQUIRED_CHANNEL} para continuar.

Después de suscribirte, usa /app nuevamente.
    `, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: `📢 Suscribirse a ${REQUIRED_CHANNEL}`,
            url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`
          }
        ], [
          {
            text: '🔄 Verificar suscripción',
            callback_data: 'check_subscription'
          }
        ]]
      }
    });
    return;
  }
  
  bot.sendMessage(chatId, '📱 Abriendo la aplicación...', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🚀 Abrir Cuba Clasificados',
          web_app: { url: WEB_APP_URL }
        }
      ]]
    }
  });
});

// Команда для администраторов: удалить объявление
bot.onText(/\/delete\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const listingId = match[1];
  
  // Проверяем, является ли пользователь администратором
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const adminIds = process.env.TELEGRAM_ADMIN_IDS;
  
  let isAdmin = false;
  if (adminId && String(userId) === String(adminId)) {
    isAdmin = true;
  } else if (adminIds) {
    const adminIdList = adminIds.split(',').map(id => id.trim());
    isAdmin = adminIdList.includes(String(userId));
  }
  
  if (!isAdmin) {
    return bot.sendMessage(chatId, '❌ У вас нет прав для выполнения этой команды.');
  }
  
  try {
    // Удаляем объявление через API (используем прямой запрос к БД)
    const path = require('path');
    const dbInitPath = path.join(__dirname, '../server/database/init');
    const { pool } = require(dbInitPath);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Получаем информацию об объявлении перед удалением
      const listingResult = await client.query(
        'SELECT l.*, u.telegram_id, u.username FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1',
        [listingId]
      );
      
      if (listingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return bot.sendMessage(chatId, `❌ Объявление #${listingId} не найдено.`);
      }
      
      const listing = listingResult.rows[0];
      
      // Удаляем фотографии
      const photos = await client.query(
        'SELECT photo_url FROM listing_photos WHERE listing_id = $1',
        [listingId]
      );
      
      const fs = require('fs');
      const path = require('path');
      for (const photo of photos.rows) {
        const photoPath = photo.photo_url;
        const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', photoPath.replace('/uploads/', ''));
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.warn('Error deleting photo file:', err.message);
        }
      }
      
      // Удаляем записи о фотографиях
      await client.query('DELETE FROM listing_photos WHERE listing_id = $1', [listingId]);
      
      // Удаляем объявление
      await client.query('DELETE FROM listings WHERE id = $1', [listingId]);
      
      await client.query('COMMIT');
      
      bot.sendMessage(chatId, 
        `✅ Объявление #${listingId} успешно удалено администратором.\n\n` +
        `📋 Информация об объявлении:\n` +
        `Заголовок: ${listing.title}\n` +
        `Владелец: @${listing.username || 'не указан'} (${listing.telegram_id})\n` +
        `Удалил: @${msg.from.username || 'не указан'} (${userId})`
      );
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting listing via bot:', error);
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message || 'Не удалось удалить объявление'}`);
  }
});

// Обработка callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  if (data === 'check_subscription') {
    const isSubscribed = await checkChannelSubscription(userId);
    
    if (isSubscribed) {
      bot.answerCallbackQuery(query.id, { text: '✅ ¡Estás suscrito!', show_alert: false });
      bot.sendMessage(chatId, `
✅ ¡Perfecto! Estás suscrito al canal.

Ahora puedes usar la aplicación:
      `, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Abrir aplicación',
              web_app: { url: WEB_APP_URL }
            }
          ]]
        }
      });
    } else {
      bot.answerCallbackQuery(query.id, { text: '❌ Aún no estás suscrito', show_alert: true });
      bot.sendMessage(chatId, `
⚠️ Aún no estás suscrito al canal ${REQUIRED_CHANNEL}.

Por favor, suscríbete y vuelve a intentar.
      `, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: `📢 Suscribirse a ${REQUIRED_CHANNEL}`,
              url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`
            }
          ]]
        }
      });
    }
  } else {
    bot.answerCallbackQuery(query.id);
  }
});

// Обработка всех текстовых сообщений (если пользователь пишет что-то, что не команда)
bot.on('message', (msg) => {
  // Пропускаем команды (они обрабатываются через onText)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  // Если это обычное сообщение, предлагаем использовать команды
  if (msg.text) {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
👋 Hola! Para usar el bot, usa los comandos:

/start - Iniciar el bot
/app - Abrir la aplicación
/help - Ver ayuda

O simplemente toca el botón de menú (☰) para ver los comandos disponibles.
    `, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Abrir aplicación',
            web_app: { url: WEB_APP_URL }
          }
        ]]
      }
    });
  }
});

// Обработка ошибок бота
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
  if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 401) {
    console.error('❌ Invalid bot token! Check TELEGRAM_BOT_TOKEN in .env');
    process.exit(1);
  }
});

// Обработка ошибок при отправке сообщений
bot.on('error', (error) => {
  console.error('❌ Bot error:', error.message);
});

console.log('🤖 Telegram Bot is running...');
console.log(`📱 Web App URL: ${WEB_APP_URL}`);
console.log(`📢 Required channel: ${REQUIRED_CHANNEL}`);

module.exports = bot;

