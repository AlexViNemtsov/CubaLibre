-- Миграция: Добавление поля views (количество просмотров) в таблицу listings

-- Добавляем поле views, если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'listings' AND column_name = 'views'
    ) THEN
        ALTER TABLE listings ADD COLUMN views INTEGER DEFAULT 0 NOT NULL;
        CREATE INDEX idx_listings_views ON listings(views DESC);
        RAISE NOTICE 'Column views added to listings table';
    ELSE
        RAISE NOTICE 'Column views already exists';
    END IF;
END $$;
