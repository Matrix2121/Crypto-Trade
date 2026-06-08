package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OhlcIntervalPolicyTest {

    @Test
    void krakenSyncIntervals_excludesAggregationOnly() {
        var intervals = OhlcIntervalPolicy.krakenSyncIntervals().stream()
                .map(OhlcIntervalPolicy.IntervalSpec::intervalString)
                .toList();

        assertTrue(intervals.contains("1m"));
        assertTrue(intervals.contains("30m"));
        assertTrue(intervals.contains("1d"));
        assertFalse(intervals.contains("1h"));
        assertFalse(intervals.contains("4h"));
    }

    @Test
    void oneHourInterval_retainedIndefinitelyForMlTraining() {
        var oneHour = OhlcIntervalPolicy.findByIntervalString("1h").orElseThrow();

        assertFalse(oneHour.retentionMs().isPresent());
    }

    @Test
    void intervalsWithRetention_excludesUnlimitedDailyMonthlyAndHourly() {
        var retained = OhlcIntervalPolicy.intervalsWithRetention().stream()
                .map(OhlcIntervalPolicy.IntervalSpec::intervalString)
                .toList();

        assertFalse(retained.contains("1d"));
        assertFalse(retained.contains("1mo"));
        assertFalse(retained.contains("1h"));
    }

    @Test
    void windowStartMs_boundedIntervalUsesRetention() {
        long now = 1_000_000L;
        long start = OhlcIntervalPolicy.windowStartMs("1m", now);

        assertEquals(now - 2L * 24 * 60 * 60 * 1000, start);
    }

    @Test
    void windowStartMs_unlimitedIntervalStartsAtZero() {
        assertEquals(0L, OhlcIntervalPolicy.windowStartMs("1d", 1_000_000L));
    }
}
