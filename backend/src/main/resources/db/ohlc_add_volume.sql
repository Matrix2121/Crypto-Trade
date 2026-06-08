-- Manual migration: add volume to ohlc_data (run once on existing databases)
ALTER TABLE ohlc_data ADD COLUMN IF NOT EXISTS volume NUMERIC(24, 8) DEFAULT 0 NOT NULL;
