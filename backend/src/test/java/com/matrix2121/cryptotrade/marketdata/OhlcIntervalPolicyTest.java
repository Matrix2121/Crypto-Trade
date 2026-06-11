package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OhlcIntervalPolicyTest {

    @Test
    void krakenBaseIntervals_includesOnly1mAnd1d() {
        var intervals = OhlcIntervalPolicy.krakenBaseIntervals().stream()
                .map(OhlcIntervalPolicy.BaseIntervalSpec::name)
                .toList();

        assertEquals(2, intervals.size());
        assertTrue(intervals.contains("1m"));
        assertTrue(intervals.contains("1d"));
        assertFalse(intervals.contains("30m"));
        assertFalse(intervals.contains("1h"));
    }

    @Test
    void oneMinuteInterval_hasTwoDayRetention() {
        var oneMinute = OhlcIntervalPolicy.findByName("1m").orElseThrow();

        assertTrue(oneMinute.retentionMs().isPresent());
        assertEquals(2L * 24 * 60 * 60 * 1000, oneMinute.retentionMs().get());
    }

    @Test
    void dailyInterval_hasUnlimitedRetention() {
        var daily = OhlcIntervalPolicy.findByName("1d").orElseThrow();

        assertFalse(daily.retentionMs().isPresent());
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
