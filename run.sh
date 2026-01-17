#!/bin/bash

# Скрипт для запуска всего проекта

echo "🚀 Запуск Cuba Clasificados Bot..."

# Проверка .env файла
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден!"
    echo "📝 Создаю .env файл из примера..."
    
    cat > .env << EOF
TELEGRAM_BOT_TOKEN=your_bot_token_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cuba_clasificados
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=./uploads
WEB_APP_URL=http://localhost:5173
EOF
    
    echo "✅ Файл .env создан!"
    echo "⚠️  Проверьте настройки базы данных в .env файле"
fi

# Создание директории для загрузок
mkdir -p uploads

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей backend..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Установка зависимостей frontend..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "✅ Все готово к запуску!"
echo ""
echo "📋 Инструкции:"
echo "1. Откройте ТЕРМИНАЛ 1 и запустите: npm run dev"
echo "2. Откройте ТЕРМИНАЛ 2 и запустите: cd frontend && npm run dev"
echo "3. Откройте ТЕРМИНАЛ 3 (опционально) для бота: node bot/index.js"
echo ""
echo "🌐 После запуска:"
echo "   - Backend: http://localhost:3000"
echo "   - Frontend: http://localhost:5173"
echo "   - Health check: http://localhost:3000/api/health"
echo ""
echo "📱 Настройте Telegram Bot через @BotFather:"
echo "   /newapp → выберите бота → Web App URL: http://localhost:5173"
echo ""




