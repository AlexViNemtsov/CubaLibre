const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://cuba-clasificados.online';

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;
  
  bot.sendMessage(chatId, `
👋 ¡Hola, ${firstName}!

Bienvenido a Cuba Clasificados — tu tablón de anuncios local.

🏠 Alquiler
👕 Artículos personales  
🛠 Servicios

Usa el botón de abajo para abrir la aplicación:
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
  
  bot.sendMessage(chatId, `
📖 Comandos disponibles:

/start - Iniciar el bot
/help - Ver esta ayuda
/app - Abrir la aplicación

ℹ️ Información:
• Publica anuncios gratis
• Contacta directamente con vendedores
• Optimizado para conexiones lentas
  `);
});

// Команда /app
bot.onText(/\/app/, (msg) => {
  const chatId = msg.chat.id;
  
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

// Обработка callback queries
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  bot.answerCallbackQuery(query.id);
});

console.log('🤖 Telegram Bot is running...');

module.exports = bot;

