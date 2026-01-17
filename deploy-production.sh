#!/bin/bash

# Скрипт для деплоя на продакшн
# Frontend: reg.ru
# Backend: Render (через GitHub)

set -e

echo "🚀 Подготовка к деплою на продакшн..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Запрашиваем URL backend на Render
echo -e "${YELLOW}Введите URL вашего backend на Render (например: https://cuba-clasificados.onrender.com):${NC}"
read -r RENDER_URL

# Убираем слеш в конце если есть
RENDER_URL=${RENDER_URL%/}
API_URL="${RENDER_URL}/api"

echo ""
echo -e "${GREEN}✅ Backend URL: ${RENDER_URL}${NC}"
echo -e "${GREEN}✅ API URL: ${API_URL}${NC}"
echo ""

# Сборка frontend с правильным API URL
echo "📦 Сборка frontend..."
cd frontend

# Временно обновляем vite.config.js для сборки с правильным API URL
# Создаем backup
cp vite.config.js vite.config.js.backup

# Обновляем API URL в vite.config.js
cat > vite.config.js << EOF
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  define: {
    // Для production используем URL Render backend
    'import.meta.env.VITE_API_URL': JSON.stringify('${API_URL}')
  }
});
EOF

# Собираем
npm run build

# Восстанавливаем оригинальный vite.config.js
mv vite.config.js.backup vite.config.js

cd ..

echo ""
echo -e "${GREEN}✅ Frontend собран!${NC}"
echo ""

# Создаем архив для reg.ru
echo "📦 Создание архива для reg.ru..."
tar -czf frontend-dist.tar.gz -C frontend/dist .

echo ""
echo -e "${GREEN}✅ Архив создан: frontend-dist.tar.gz${NC}"
echo ""

# Проверяем Git статус
echo "🔍 Проверка Git статуса..."
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Есть незакоммиченные изменения!${NC}"
  echo "Хотите закоммитить и запушить? (y/n)"
  read -r answer
  if [ "$answer" = "y" ]; then
    git add .
    echo "Введите сообщение коммита:"
    read -r commit_message
    git commit -m "$commit_message"
    git push origin main
    echo -e "${GREEN}✅ Изменения отправлены в GitHub${NC}"
    echo ""
    echo -e "${GREEN}✅ Render автоматически задеплоит изменения!${NC}"
  fi
else
  echo -e "${GREEN}✅ Все изменения закоммичены${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Готово к деплою!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Backend на Render:"
echo "   - Проверьте, что код в GitHub"
echo "   - Render автоматически задеплоит"
echo "   - Проверьте переменные окружения на Render:"
echo "     * REQUIRED_CHANNEL=@CubaClasificados"
echo "     * FRONTEND_URL=https://ваш-домен-reg.ru"
echo "     * WEB_APP_URL=https://ваш-домен-reg.ru"
echo ""
echo "2. Frontend на reg.ru:"
echo "   - Загрузите frontend-dist.tar.gz на reg.ru"
echo "   - Распакуйте в корень сайта (public_html/ или www/)"
echo "   - Убедитесь, что index.html в корне"
echo ""
echo "3. Настройка BotFather:"
echo "   - /myapps → выберите бота → Web App → Edit"
echo "   - Web App URL: https://ваш-домен-reg.ru"
echo ""
echo "4. Проверка:"
echo "   - Backend: ${RENDER_URL}/api/health"
echo "   - Frontend: https://ваш-домен-reg.ru"
echo "   - Бот: /start в Telegram"
echo ""
