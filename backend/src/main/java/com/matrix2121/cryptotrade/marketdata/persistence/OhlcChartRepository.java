package com.matrix2121.cryptotrade.marketdata.persistence;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;

@Repository
public class OhlcChartRepository {

    private final JdbcTemplate jdbcTemplate;

    public OhlcChartRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<OhlcDto> findCandles(String viewName, String symbol, Instant cutoff) {
        String sql = """
                SELECT CAST(EXTRACT(EPOCH FROM bucket) * 1000 AS BIGINT) AS ts,
                       open, high, low, close, volume
                FROM %s
                WHERE symbol = ?
                  AND bucket >= ?
                ORDER BY bucket ASC
                """.formatted(viewName);

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new OhlcDto(
                        rs.getLong("ts"),
                        rs.getBigDecimal("open"),
                        rs.getBigDecimal("high"),
                        rs.getBigDecimal("low"),
                        rs.getBigDecimal("close"),
                        rs.getBigDecimal("volume")),
                symbol,
                Timestamp.from(cutoff));
    }

    public List<OhlcDto> findCandlesFromEpoch(String viewName, String symbol, long cutoffMs) {
        return findCandles(viewName, symbol, Instant.ofEpochMilli(cutoffMs));
    }

    public List<OhlcDto> findAllCandles(String viewName, String symbol) {
        String sql = """
                SELECT CAST(EXTRACT(EPOCH FROM bucket) * 1000 AS BIGINT) AS ts,
                       open, high, low, close, volume
                FROM %s
                WHERE symbol = ?
                ORDER BY bucket ASC
                """.formatted(viewName);

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new OhlcDto(
                        rs.getLong("ts"),
                        rs.getBigDecimal("open"),
                        rs.getBigDecimal("high"),
                        rs.getBigDecimal("low"),
                        rs.getBigDecimal("close"),
                        rs.getBigDecimal("volume")),
                symbol);
    }

    public BigDecimal findCloseAtOrBefore(String viewName, String symbol, Instant target) {
        String sql = """
                SELECT close
                FROM %s
                WHERE symbol = ?
                  AND bucket <= ?
                ORDER BY bucket DESC
                LIMIT 1
                """.formatted(viewName);

        List<BigDecimal> results = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> rs.getBigDecimal("close"),
                symbol,
                Timestamp.from(target));
        return results.isEmpty() ? null : results.get(0);
    }

    public BigDecimal findLatestClose(String viewName, String symbol) {
        String sql = """
                SELECT close
                FROM %s
                WHERE symbol = ?
                ORDER BY bucket DESC
                LIMIT 1
                """.formatted(viewName);

        List<BigDecimal> results = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> rs.getBigDecimal("close"),
                symbol);
        return results.isEmpty() ? null : results.get(0);
    }
}
