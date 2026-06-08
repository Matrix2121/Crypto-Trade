-- ML / prediction schema (run after pgvector is enabled)
CREATE EXTENSION IF NOT EXISTS vector;

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
