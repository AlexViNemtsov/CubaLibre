#!/bin/bash

# Скрипт для быстрого деплоя frontend на reg.ru
# Использование: ./deploy-frontend.sh

set -e

echo "🚀 Сборка frontend..."

cd frontend
npm run build
cd ..

echo "📦 Создание архива для reg.ru..."

# Копируем .htaccess если есть
if [ -f .htaccess ]; then
  cp .htaccess frontend/dist/
fi

# Создаем архив
tar -czf frontend-dist.tar.gz -C frontend/dist .

echo ""
echo "✅ Готово! Архив создан: frontend-dist.tar.gz"
echo ""
echo "📋 Следующие шаги:"
echo "1. Загрузи frontend-dist.tar.gz на reg.ru"
echo "2. Распакуй в /www/cuba-clasificado/"
echo "3. Готово!"
echo ""
