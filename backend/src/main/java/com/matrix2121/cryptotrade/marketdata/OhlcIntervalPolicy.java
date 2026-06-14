package com.matrix2121.cryptotrade.marketdata;

import java.util.List;
import java.util.Optional;

/**
 * Kraken sync configuration for base OHLC hypertables ({@code ohlc_1m}, {@code ohlc_1d}).
 * Coarser chart intervals are served by TimescaleDB continuous aggregates.
 */
public final class OhlcIntervalPolicy {

    public record BaseIntervalSpec(
            String name,
            int krakenIntervalMinutes,
            Optional<Long> retentionMs) {
    }

    private static final long MS_PER_MINUTE = 60_000L;
    private static final long MS_PER_DAY = 24L * 60L * MS_PER_MINUTE;

    private static final List<BaseIntervalSpec> KRAKEN_BASE_INTERVALS = List.of(
            new BaseIntervalSpec("1m", 1, Optional.of(2L * MS_PER_DAY)),
            new BaseIntervalSpec("1d", 1440, Optional.empty()));

    private OhlcIntervalPolicy() {
    }

    public static List<BaseIntervalSpec> krakenBaseIntervals() {
        return KRAKEN_BASE_INTERVALS;
    }

    public static Optional<BaseIntervalSpec> findByName(String name) {
        return KRAKEN_BASE_INTERVALS.stream()
                .filter(spec -> spec.name().equals(name))
                .findFirst();
    }

    public static long intervalStepMs(String name) {
        return findByName(name)
                .map(spec -> spec.krakenIntervalMinutes() * MS_PER_MINUTE)
                .orElseThrow(() -> new IllegalArgumentException("Unknown base interval: " + name));
    }

    public static long windowStartMs(String name, long nowMs) {
        Optional<Long> retention = findByName(name).flatMap(BaseIntervalSpec::retentionMs);
        if (retention.isEmpty()) {
            return 0L;
        }
        return nowMs - retention.get();
    }
}
