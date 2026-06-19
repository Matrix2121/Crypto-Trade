package com.matrix2121.cryptotrade.marketdata;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Refreshes TimescaleDB continuous aggregates after historical OHLC backfill.
 */
@Slf4j
@Service
public class ContinuousAggregateRefreshService {

    private static final List<String> ONE_MINUTE_DERIVED = List.of(
            "ohlc_30m",
            "ohlc_1h",
            "ohlc_2h",
            "ohlc_4h",
            "ohlc_8h");

    private final JdbcTemplate jdbcTemplate;

    public ContinuousAggregateRefreshService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void refreshOneMinuteDerived() {
        for (String view : ONE_MINUTE_DERIVED) {
            log.info("Refreshing continuous aggregate {}", view);
            jdbcTemplate.execute(
                    "CALL refresh_continuous_aggregate('" + view + "', NULL, NULL)");
        }
    }
}
