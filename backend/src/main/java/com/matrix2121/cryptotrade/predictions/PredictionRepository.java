package com.matrix2121.cryptotrade.predictions;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class PredictionRepository {

    private static final String SELECT_COLUMNS = """
            SELECT id, asset, predicted_at, source, use_rag,
                   ml_1h_price, ml_1h_ci_low, ml_1h_ci_high,
                   ml_price, ml_ci_low, ml_ci_high,
                   context_aware_price, context_aware_ci_low, context_aware_ci_high,
                   context_prediction_json::text AS context_prediction_json,
                   context_snapshot_json::text AS context_snapshot_json,
                   tuning_params_json::text AS tuning_params_json,
                   rag_precedents_json::text AS rag_precedents_json,
                   actual_price_24h
            """;

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<PredictionRow> rowMapper = this::mapRow;

    public PredictionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<PredictionRow> findLatestHourly(String asset) {
        String sql = SELECT_COLUMNS + """
                FROM predictions
                WHERE asset = ? AND ml_1h_price IS NOT NULL
                ORDER BY predicted_at DESC
                LIMIT 1
                """;
        List<PredictionRow> rows = jdbcTemplate.query(sql, rowMapper, asset);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<PredictionRow> findLatestDaily(String asset) {
        String sql = SELECT_COLUMNS + """
                FROM predictions
                WHERE asset = ? AND ml_price IS NOT NULL
                ORDER BY predicted_at DESC
                LIMIT 1
                """;
        List<PredictionRow> rows = jdbcTemplate.query(sql, rowMapper, asset);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public List<PredictionRow> findHistory(String asset, int limit) {
        String sql = SELECT_COLUMNS + """
                FROM predictions
                WHERE asset = ?
                ORDER BY predicted_at DESC
                LIMIT ?
                """;
        return jdbcTemplate.query(sql, rowMapper, asset, limit);
    }

    private PredictionRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new PredictionRow(
                rs.getLong("id"),
                rs.getString("asset"),
                toOffsetDateTime(rs.getTimestamp("predicted_at")),
                rs.getString("source"),
                rs.getBoolean("use_rag"),
                rs.getBigDecimal("ml_1h_price"),
                rs.getBigDecimal("ml_1h_ci_low"),
                rs.getBigDecimal("ml_1h_ci_high"),
                rs.getBigDecimal("ml_price"),
                rs.getBigDecimal("ml_ci_low"),
                rs.getBigDecimal("ml_ci_high"),
                rs.getBigDecimal("context_aware_price"),
                rs.getBigDecimal("context_aware_ci_low"),
                rs.getBigDecimal("context_aware_ci_high"),
                rs.getString("context_prediction_json"),
                rs.getString("context_snapshot_json"),
                rs.getString("tuning_params_json"),
                rs.getString("rag_precedents_json"),
                rs.getBigDecimal("actual_price_24h"));
    }

    private static OffsetDateTime toOffsetDateTime(Timestamp ts) {
        if (ts == null) {
            return null;
        }
        return ts.toInstant().atOffset(ZoneOffset.UTC);
    }
}
