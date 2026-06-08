package com.matrix2121.cryptotrade.marketdata;

import java.util.List;
import java.util.Optional;

/**
 * Retention windows and Kraken sync configuration for OHLC intervals.
 */
public final class OhlcIntervalPolicy {

    public enum DataSource {
        KRAKEN,
        AGGREGATION,
        KRAKEN_AND_AGGREGATION
    }

    public record IntervalSpec(
            String intervalString,
            int krakenIntervalMinutes,
            DataSource source,
            Optional<Long> retentionMs) {
    }

    private static final long MS_PER_MINUTE = 60_000L;
    private static final long MS_PER_HOUR = 60L * MS_PER_MINUTE;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;

    private static final List<IntervalSpec> ALL_INTERVALS = List.of(
            new IntervalSpec("1m", 1, DataSource.KRAKEN_AND_AGGREGATION, Optional.of(2L * MS_PER_DAY)),
            new IntervalSpec("30m", 30, DataSource.KRAKEN_AND_AGGREGATION, Optional.of(2L * MS_PER_DAY)),
            new IntervalSpec("1h", 60, DataSource.AGGREGATION, Optional.empty()),
            new IntervalSpec("2h", 120, DataSource.AGGREGATION, Optional.of(8L * MS_PER_DAY)),
            new IntervalSpec("4h", 240, DataSource.AGGREGATION, Optional.of(40L * MS_PER_DAY)),
            new IntervalSpec("8h", 480, DataSource.AGGREGATION, Optional.of(40L * MS_PER_DAY)),
            new IntervalSpec("1d", 1440, DataSource.KRAKEN, Optional.empty()),
            new IntervalSpec("5d", 7200, DataSource.AGGREGATION, Optional.of(380L * MS_PER_DAY)),
            new IntervalSpec("1mo", 43200, DataSource.AGGREGATION, Optional.empty()));

    private static final List<IntervalSpec> KRAKEN_SYNC_INTERVALS = ALL_INTERVALS.stream()
            .filter(spec -> spec.source() == DataSource.KRAKEN || spec.source() == DataSource.KRAKEN_AND_AGGREGATION)
            .toList();

    private OhlcIntervalPolicy() {
    }

    public static List<IntervalSpec> allIntervals() {
        return ALL_INTERVALS;
    }

    public static List<IntervalSpec> krakenSyncIntervals() {
        return KRAKEN_SYNC_INTERVALS;
    }

    public static List<IntervalSpec> intervalsWithRetention() {
        return ALL_INTERVALS.stream()
                .filter(spec -> spec.retentionMs().isPresent())
                .toList();
    }

    public static Optional<IntervalSpec> findByIntervalString(String intervalString) {
        return ALL_INTERVALS.stream()
                .filter(spec -> spec.intervalString().equals(intervalString))
                .findFirst();
    }

    public static long intervalStepMs(String intervalString) {
        return findByIntervalString(intervalString)
                .map(spec -> spec.krakenIntervalMinutes() * MS_PER_MINUTE)
                .orElseThrow(() -> new IllegalArgumentException("Unknown interval: " + intervalString));
    }

    public static long windowStartMs(String intervalString, long nowMs) {
        Optional<Long> retention = findByIntervalString(intervalString)
                .flatMap(IntervalSpec::retentionMs);
        if (retention.isEmpty()) {
            return 0L;
        }
        return nowMs - retention.get();
    }
}
