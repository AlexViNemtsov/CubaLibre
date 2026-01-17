# Быстрая настройка

## Шаг 1: Установка зависимостей

```bash
# Backend зависимости
npm install

# Frontend зависимости
cd frontend
npm install
cd ..
```

## Шаг 2: Настройка базы данных

### Вариант A: Локальная PostgreSQL

```bash
# Создать базу данных
createdb cuba_clasificados

# Или через psql
psql -U postgres
CREATE DATABASE cuba_clasificados;
\q
```

### Вариант B: Supabase (рекомендуется для быстрого старта)

1. Создайте проект на [supabase.com](https://supabase.com)
2. Скопируйте connection string
3. Обновите `.env` файл

## Шаг 3: Создание .env файла

Создайте файл `.env` в корне проекта:

```env
TELEGRAM_BOT_TOKEN=8418701976:AAHReaTPs92VXuc8pofZSKo_Q_K-4GDCQhY
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
```

Для Supabase используйте:
```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
```

## Шаг 4: Инициализация базы данных

База данных инициализируется автоматически при первом запуске сервера.

Или вручную:
```bash
psql -U postgres -d cuba_clasificados -f server/database/schema.sql
```

## Шаг 5: Настройка Telegram Bot

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newapp`
3. Выберите вашего бота (или создайте нового через `/newbot`)
4. Заполните данные:
   - Название: Cuba Clasificados
   - Описание: Доска объявлений для Кубы
   - Web App URL: `http://localhost:5173` (для разработки) или ваш домен

## Шаг 6: Запуск

### Разработка (3 терминала)

**Терминал 1 - Backend:**
```bash
npm run dev
```

**Терминал 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Терминал 3 - Telegram Bot (опционально):**
```bash
node bot/index.js
```

### Production

```bash
# Сборка frontend
npm run build

# Запуск сервера
npm start
```

## Шаг 7: Тестирование

1. Откройте Telegram
2. Найдите вашего бота
3. Отправьте `/start`
4. Нажмите кнопку "Открыть приложение"
5. Протестируйте создание объявления

## Решение проблем

### Ошибка подключения к БД
- Проверьте, что PostgreSQL запущен
- Проверьте credentials в `.env`
- Убедитесь, что база данных создана

### Ошибка при загрузке изображений
- Убедитесь, что директория `uploads` существует
- Проверьте права доступа к директории

### Frontend не подключается к API
- Проверьте `VITE_API_URL` в `frontend/.env`
- Убедитесь, что backend запущен на порту 3000
- Проверьте CORS настройки

### Telegram Web App не работает
- Убедитесь, что используете HTTPS в production
- Проверьте, что Web App URL настроен в BotFather
- Проверьте токен бота в `.env`




