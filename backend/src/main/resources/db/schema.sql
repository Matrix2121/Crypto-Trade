-- =============================================================================
-- Crypto-Trade — complete PostgreSQL schema (current as of 2026-06-09)
-- =============================================================================
--
-- Single source of truth for fresh database initialization.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
--
-- NOT included here (data, not structure):
--   ml-service/deploy/market_events_seed.sql  — RAG row seed (~13 MB)
--   pg_dump restore                           — full DB clone (OHLC, users, etc.)
--
-- Version: see schema.version (applied by scripts/db_migrate.sh on deploy).
-- Docker: mounted as docker-entrypoint-initdb.d/01_schema.sql (fresh volume only).
-- Existing DB: scripts/db_migrate.sh (backs up, then applies this file if needed).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- App: users, portfolio, transactions
-- (JDBC-backed; not created by JPA ddl-auto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           BIGSERIAL PRIMARY KEY,
    email        VARCHAR(255) NOT NULL UNIQUE,
    username     VARCHAR(255) NOT NULL UNIQUE,
    balance      NUMERIC(24, 8) NOT NULL DEFAULT 10000,
    picture_url  VARCHAR(2048),
    is_admin     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS assets (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    crypto_code   VARCHAR(32) NOT NULL,
    crypto_amount NUMERIC(24, 8) NOT NULL DEFAULT 0,
    CONSTRAINT uk_assets_user_crypto UNIQUE (user_id, crypto_code)
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    crypto_code            VARCHAR(32) NOT NULL,
    unit_price             NUMERIC(24, 8) NOT NULL,
    crypto_amount          NUMERIC(24, 8) NOT NULL,
    local_currency_amount  NUMERIC(24, 8) NOT NULL,
    is_purchase            BOOLEAN NOT NULL,
    trade_timestamp        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id, trade_timestamp DESC);

-- -----------------------------------------------------------------------------
-- Favorites (also managed by JPA UserFavorite entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_favorite (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol      VARCHAR(32)  NOT NULL,
    sort_order  INTEGER      NOT NULL,
    CONSTRAINT uk_user_favorite_user_symbol UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_user_sort
    ON user_favorite (user_id, sort_order);

-- -----------------------------------------------------------------------------
-- Market data: OHLC candles (JPA OhlcData entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ohlc_data (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(32)  NOT NULL,
    interval_string VARCHAR(8)   NOT NULL,
    timestamp       BIGINT       NOT NULL,
    open            NUMERIC(24, 8) NOT NULL,
    high            NUMERIC(24, 8) NOT NULL,
    low             NUMERIC(24, 8) NOT NULL,
    close           NUMERIC(24, 8) NOT NULL,
    volume          NUMERIC(24, 8) NOT NULL DEFAULT 0,
    CONSTRAINT uk_ohlc_symbol_interval_timestamp UNIQUE (symbol, interval_string, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_ohlc_symbol ON ohlc_data (symbol);
CREATE INDEX IF NOT EXISTS idx_ohlc_interval_string ON ohlc_data (interval_string);
CREATE INDEX IF NOT EXISTS idx_ohlc_timestamp ON ohlc_data (timestamp);
CREATE INDEX IF NOT EXISTS idx_ohlc_symbol_interval ON ohlc_data (symbol, interval_string);

-- -----------------------------------------------------------------------------
-- Market stats cache (JPA TrackedAsset entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_asset (
    symbol               VARCHAR(32) PRIMARY KEY,
    market_rank          INTEGER,
    market_cap           BIGINT,
    circulating_supply   BIGINT,
    all_time_high        NUMERIC(24, 8),
    ath_timestamp        BIGINT,
    change_24h           DOUBLE PRECISION,
    volume_24h           BIGINT,
    coingecko_id         VARCHAR(64)
);

-- -----------------------------------------------------------------------------
-- ML: predictions + RAG index
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
    id                      BIGSERIAL PRIMARY KEY,
    asset                   VARCHAR(32) NOT NULL,
    predicted_at            TIMESTAMPTZ NOT NULL,
    source                  VARCHAR(16) NOT NULL DEFAULT 'live',
    use_rag                 BOOLEAN NOT NULL DEFAULT TRUE,
    ml_1h_price             NUMERIC(24, 8),
    ml_1h_ci_low            NUMERIC(24, 8),
    ml_1h_ci_high           NUMERIC(24, 8),
    ml_price                NUMERIC(24, 8),
    ml_ci_low               NUMERIC(24, 8),
    ml_ci_high              NUMERIC(24, 8),
    context_aware_price     NUMERIC(24, 8),
    context_aware_ci_low    NUMERIC(24, 8),
    context_aware_ci_high   NUMERIC(24, 8),
    context_prediction_json JSONB,
    context_snapshot_json   JSONB,
    tuning_params_json      JSONB,
    rag_precedents_json     JSONB,
    actual_price_24h        NUMERIC(24, 8),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_asset_predicted ON predictions (asset, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_source ON predictions (source);

CREATE TABLE IF NOT EXISTS market_events (
    id                SERIAL PRIMARY KEY,
    asset             VARCHAR(32) NOT NULL,
    event_timestamp   TIMESTAMPTZ NOT NULL,
    snapshot_json     JSONB NOT NULL,
    embedding         vector(384) NOT NULL,
    actual_price_24h  NUMERIC(24, 8),
    actual_change_pct NUMERIC(10, 6),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (asset, event_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_events_asset_ts ON market_events (asset, event_timestamp DESC);

-- -----------------------------------------------------------------------------
-- App: SQL functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_balance_by_user_id(p_user_id BIGINT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
    SELECT balance FROM users WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_assets_by_user_id(p_user_id BIGINT)
RETURNS TABLE (
    id            BIGINT,
    crypto_code   VARCHAR,
    crypto_amount NUMERIC,
    user_id       BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT a.id, a.crypto_code, a.crypto_amount, a.user_id
    FROM assets a
    WHERE a.user_id = p_user_id
      AND a.crypto_amount > 0
    ORDER BY a.crypto_code;
$$;

CREATE OR REPLACE FUNCTION get_transactions_by_user_id(p_user_id BIGINT)
RETURNS TABLE (
    id                    BIGINT,
    crypto_code           VARCHAR,
    unit_price            NUMERIC,
    crypto_amount         NUMERIC,
    local_currency_amount NUMERIC,
    is_purchase           BOOLEAN,
    trade_timestamp       TIMESTAMP,
    user_id               BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        t.id,
        t.crypto_code,
        t.unit_price,
        t.crypto_amount,
        t.local_currency_amount,
        t.is_purchase,
        t.trade_timestamp,
        t.user_id
    FROM transactions t
    WHERE t.user_id = p_user_id
    ORDER BY t.trade_timestamp DESC;
$$;

CREATE OR REPLACE FUNCTION get_transaction_by_transaction_id(p_transaction_id BIGINT)
RETURNS TABLE (
    id                    BIGINT,
    crypto_code           VARCHAR,
    unit_price            NUMERIC,
    crypto_amount         NUMERIC,
    local_currency_amount NUMERIC,
    is_purchase           BOOLEAN,
    trade_timestamp       TIMESTAMP,
    user_id               BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        t.id,
        t.crypto_code,
        t.unit_price,
        t.crypto_amount,
        t.local_currency_amount,
        t.is_purchase,
        t.trade_timestamp,
        t.user_id
    FROM transactions t
    WHERE t.id = p_transaction_id;
$$;

CREATE OR REPLACE FUNCTION reset_user_by_id(p_user_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RETURN FALSE;
    END IF;

    DELETE FROM transactions WHERE user_id = p_user_id;
    DELETE FROM assets WHERE user_id = p_user_id;
    UPDATE users SET balance = 10000 WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- App: trade stored procedures
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE buy_crypto(
    IN p_user_id BIGINT,
    IN p_crypto_code VARCHAR,
    IN p_crypto_amount NUMERIC,
    IN p_unit_price NUMERIC,
    INOUT out_crypto_code VARCHAR,
    INOUT out_crypto_amount NUMERIC,
    INOUT out_unit_price NUMERIC,
    INOUT out_old_crypto_balance NUMERIC,
    INOUT out_new_crypto_balance NUMERIC,
    INOUT out_fiat_paid NUMERIC,
    INOUT out_timestamp TIMESTAMP
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fiat_cost NUMERIC;
    v_balance NUMERIC;
    v_old_amount NUMERIC;
BEGIN
    IF p_crypto_amount <= 0 OR p_unit_price <= 0 THEN
        RAISE EXCEPTION 'Invalid trade amount or price';
    END IF;

    v_fiat_cost := p_crypto_amount * p_unit_price;

    SELECT balance INTO v_balance
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF v_balance < v_fiat_cost THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE users
    SET balance = balance - v_fiat_cost
    WHERE id = p_user_id;

    SELECT crypto_amount INTO v_old_amount
    FROM assets
    WHERE user_id = p_user_id
      AND crypto_code = p_crypto_code
    FOR UPDATE;

    IF NOT FOUND THEN
        v_old_amount := 0;
        INSERT INTO assets (user_id, crypto_code, crypto_amount)
        VALUES (p_user_id, p_crypto_code, p_crypto_amount);
    ELSE
        UPDATE assets
        SET crypto_amount = crypto_amount + p_crypto_amount
        WHERE user_id = p_user_id
          AND crypto_code = p_crypto_code;
    END IF;

    out_timestamp := NOW();

    INSERT INTO transactions (
        user_id,
        crypto_code,
        unit_price,
        crypto_amount,
        local_currency_amount,
        is_purchase,
        trade_timestamp
    )
    VALUES (
        p_user_id,
        p_crypto_code,
        p_unit_price,
        p_crypto_amount,
        v_fiat_cost,
        TRUE,
        out_timestamp
    );

    out_crypto_code := p_crypto_code;
    out_crypto_amount := p_crypto_amount;
    out_unit_price := p_unit_price;
    out_old_crypto_balance := v_old_amount;
    out_new_crypto_balance := v_old_amount + p_crypto_amount;
    out_fiat_paid := v_fiat_cost;
END;
$$;

CREATE OR REPLACE PROCEDURE sell_crypto(
    IN p_user_id BIGINT,
    IN p_crypto_code VARCHAR,
    IN p_crypto_amount NUMERIC,
    IN p_unit_price NUMERIC,
    INOUT out_crypto_code VARCHAR,
    INOUT out_crypto_amount NUMERIC,
    INOUT out_unit_price NUMERIC,
    INOUT out_old_crypto_balance NUMERIC,
    INOUT out_new_crypto_balance NUMERIC,
    INOUT out_fiat_gained NUMERIC,
    INOUT out_timestamp TIMESTAMP
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fiat_gain NUMERIC;
    v_old_amount NUMERIC;
    v_new_amount NUMERIC;
BEGIN
    IF p_crypto_amount <= 0 OR p_unit_price <= 0 THEN
        RAISE EXCEPTION 'Invalid trade amount or price';
    END IF;

    v_fiat_gain := p_crypto_amount * p_unit_price;

    SELECT crypto_amount INTO v_old_amount
    FROM assets
    WHERE user_id = p_user_id
      AND crypto_code = p_crypto_code
    FOR UPDATE;

    IF NOT FOUND OR v_old_amount < p_crypto_amount THEN
        RAISE EXCEPTION 'Insufficient crypto balance';
    END IF;

    v_new_amount := v_old_amount - p_crypto_amount;

    IF v_new_amount = 0 THEN
        DELETE FROM assets
        WHERE user_id = p_user_id
          AND crypto_code = p_crypto_code;
    ELSE
        UPDATE assets
        SET crypto_amount = v_new_amount
        WHERE user_id = p_user_id
          AND crypto_code = p_crypto_code;
    END IF;

    UPDATE users
    SET balance = balance + v_fiat_gain
    WHERE id = p_user_id;

    out_timestamp := NOW();

    INSERT INTO transactions (
        user_id,
        crypto_code,
        unit_price,
        crypto_amount,
        local_currency_amount,
        is_purchase,
        trade_timestamp
    )
    VALUES (
        p_user_id,
        p_crypto_code,
        p_unit_price,
        p_crypto_amount,
        v_fiat_gain,
        FALSE,
        out_timestamp
    );

    out_crypto_code := p_crypto_code;
    out_crypto_amount := p_crypto_amount;
    out_unit_price := p_unit_price;
    out_old_crypto_balance := v_old_amount;
    out_new_crypto_balance := v_new_amount;
    out_fiat_gained := v_fiat_gain;
END;
$$;

-- -----------------------------------------------------------------------------
-- Idempotent column upgrades (DBs created before schema consolidation)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ohlc_data ADD COLUMN IF NOT EXISTS volume NUMERIC(24, 8) NOT NULL DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_price NUMERIC(24, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_ci_low NUMERIC(24, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ml_1h_ci_high NUMERIC(24, 8);
ALTER TABLE tracked_asset ADD COLUMN IF NOT EXISTS coingecko_id VARCHAR(64);

-- -----------------------------------------------------------------------------
-- Schema version tracking (used by scripts/db_migrate.sh)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_meta (
    id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    version    INTEGER NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed version on first init (db-migrate upgrades this when schema.version bumps)
INSERT INTO schema_meta (id, version, applied_at)
VALUES (1, 1, NOW())
ON CONFLICT (id) DO NOTHING;
