#!/bin/bash

# Скрипт для подготовки проекта к деплою на reg.ru

echo "🚀 Подготовка проекта для деплоя на reg.ru..."
echo ""

# Сборка frontend
echo "📦 Сборка frontend..."
cd frontend
npm run build
cd ..

# Создание архива
echo "📦 Создание архива..."
tar -czf cuba-clasificados-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='uploads/*' \
  server/ \
  bot/ \
  frontend/dist/ \
  frontend/package.json \
  package.json \
  .gitignore

echo ""
echo "✅ Архив создан: cuba-clasificados-deploy.tar.gz"
echo ""
echo "📋 Следующие шаги:"
echo "1. Загрузите архив на сервер reg.ru"
echo "2. Распакуйте: tar -xzf cuba-clasificados-deploy.tar.gz"
echo "3. Установите зависимости: npm install --production"
echo "4. Создайте .env файл с настройками"
echo "5. Запустите: npm start"
echo ""
echo "📖 Подробные инструкции в DEPLOY.md"




