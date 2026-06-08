-- Manual migration: add 1h ML prediction columns (run once on existing databases)
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_price NUMERIC(24, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_ci_low NUMERIC(24, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_ci_high NUMERIC(24, 8);
