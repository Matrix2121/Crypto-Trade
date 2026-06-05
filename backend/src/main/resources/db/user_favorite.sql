-- User favorite symbols (also created/updated by JPA ddl-auto=update)
CREATE TABLE IF NOT EXISTS user_favorite (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol      VARCHAR(32)  NOT NULL,
    sort_order  INTEGER      NOT NULL,
    CONSTRAINT uk_user_favorite_user_symbol UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_user_sort
    ON user_favorite (user_id, sort_order);
