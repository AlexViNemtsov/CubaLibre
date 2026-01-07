-- Создание базы данных
CREATE DATABASE cuba_clasificados;

-- Таблица пользователей (только для хранения данных из Telegram)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица объявлений
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'items', 'services')),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('NEIGHBORHOOD', 'CITY', 'COUNTRY')),
    city VARCHAR(100) NOT NULL DEFAULT 'La Habana',
    neighborhood VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'CUP',
    is_negotiable BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented')),
    
    -- Категория: Аренда
    rent_type VARCHAR(50) CHECK (rent_type IN ('room', 'apartment', 'house')),
    rent_period VARCHAR(50) CHECK (rent_period IN ('daily', 'monthly')),
    available_from DATE,
    is_available_now BOOLEAN DEFAULT true,
    landmark TEXT,
    -- Дополнительные поля для квартир
    rooms VARCHAR(10),
    total_area DECIMAL(10, 2),
    living_area DECIMAL(10, 2),
    floor INTEGER,
    floor_from INTEGER,
    renovation VARCHAR(50),
    furniture VARCHAR(20),
    appliances VARCHAR(20),
    internet VARCHAR(20),
    
    -- Категория: Личные вещи
    item_subcategory VARCHAR(50) CHECK (item_subcategory IN ('clothing', 'electronics', 'furniture', 'kids', 'other')),
    item_condition VARCHAR(20) CHECK (item_condition IN ('new', 'used')),
    item_brand VARCHAR(100),
    delivery_type VARCHAR(50) CHECK (delivery_type IN ('pickup', 'shipping')),
    
    -- Категория: Услуги
    service_subcategory VARCHAR(50) CHECK (service_subcategory IN ('repair', 'cleaning', 'transport', 'food', 'other')),
    service_format VARCHAR(50) CHECK (service_format IN ('one-time', 'ongoing')),
    service_area TEXT,
    
    -- Контакты
    contact_telegram VARCHAR(100),
    contact_whatsapp VARCHAR(100),
    
    -- Продвижение
    is_promoted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    is_vip BOOLEAN DEFAULT false,
    promoted_until TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица фотографий объявлений
CREATE TABLE listing_photos (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    photo_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_scope ON listings(scope);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_neighborhood ON listings(neighborhood);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX idx_listings_promoted ON listings(is_promoted DESC, created_at DESC);
CREATE INDEX idx_listings_pinned ON listings(is_pinned DESC, created_at DESC);

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();




