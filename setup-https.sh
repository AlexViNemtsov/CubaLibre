#!/bin/bash

# Скрипт для настройки HTTPS туннеля для Telegram Web App

echo "🔒 Настройка HTTPS для Telegram Web App..."
echo ""

# Проверка наличия ngrok или cloudflared
if command -v ngrok &> /dev/null; then
    echo "✅ Найден ngrok"
    echo ""
    echo "🚀 Запуск ngrok туннеля на порт 5173..."
    echo "📋 После запуска скопируйте HTTPS URL и используйте его в BotFather"
    echo ""
    ngrok http 5173
elif command -v cloudflared &> /dev/null; then
    echo "✅ Найден cloudflared"
    echo ""
    echo "🚀 Запуск cloudflared туннеля на порт 5173..."
    echo "📋 После запуска скопируйте HTTPS URL и используйте его в BotFather"
    echo ""
    cloudflared tunnel --url http://localhost:5173
else
    echo "❌ Не найден ngrok или cloudflared"
    echo ""
    echo "📦 Установите один из вариантов:"
    echo ""
    echo "Вариант 1: ngrok (рекомендуется)"
    echo "  brew install ngrok/ngrok/ngrok"
    echo "  или скачайте с https://ngrok.com/download"
    echo ""
    echo "Вариант 2: cloudflared (бесплатно)"
    echo "  brew install cloudflared"
    echo ""
    echo "После установки запустите этот скрипт снова"
    exit 1
fi




