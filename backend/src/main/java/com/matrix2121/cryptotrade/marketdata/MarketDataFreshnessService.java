package com.matrix2121.cryptotrade.marketdata;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1dRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1mRepository;

/**
 * Evaluates whether base OHLC hypertables are fresh enough for chart serving.
 * Continuous aggregates are always consistent with {@code ohlc_1m} / {@code ohlc_1d}.
 */
@Service
public class MarketDataFreshnessService {

    private static final long MS_PER_HOUR = 60L * 60 * 1_000L;

    record IntervalFreshnessSpec(String intervalString, long maxLagMs) {}

    private static final List<IntervalFreshnessSpec> BASE_INTERVALS = List.of(
            new IntervalFreshnessSpec("1m", 2L * MS_PER_HOUR),
            new IntervalFreshnessSpec("1d", 36L * MS_PER_HOUR));

    private final Ohlc1mRepository ohlc1mRepository;
    private final Ohlc1dRepository ohlc1dRepository;
    private final TrackedSymbolsService trackedSymbolsService;

    public MarketDataFreshnessService(
            Ohlc1mRepository ohlc1mRepository,
            Ohlc1dRepository ohlc1dRepository,
            TrackedSymbolsService trackedSymbolsService) {
        this.ohlc1mRepository = ohlc1mRepository;
        this.ohlc1dRepository = ohlc1dRepository;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    public record StaleInterval(
            String intervalString,
            Long lastTimestampMs,
            long maxLagMs,
            long lagMs) {

        public String lastTimestampIso() {
            if (lastTimestampMs == null) {
                return "missing";
            }
            return Instant.ofEpochMilli(lastTimestampMs).toString();
        }
    }

    public record SymbolFreshness(String symbol, List<StaleInterval> staleIntervals) {}

    public record FreshnessReport(List<SymbolFreshness> staleSymbols, int totalSymbols) {

        public boolean isAnyStale() {
            return !staleSymbols.isEmpty();
        }
    }

    public FreshnessReport checkAll() {
        return checkAll(System.currentTimeMillis());
    }

    FreshnessReport checkAll(long nowMs) {
        List<String> symbols = trackedSymbolsService.getSymbols();
        List<SymbolFreshness> stale = new ArrayList<>();

        for (String symbol : symbols) {
            List<StaleInterval> staleIntervals = checkSymbol(symbol, nowMs);
            if (!staleIntervals.isEmpty()) {
                stale.add(new SymbolFreshness(symbol, staleIntervals));
            }
        }

        return new FreshnessReport(List.copyOf(stale), symbols.size());
    }

    List<StaleInterval> checkSymbol(String symbol, long nowMs) {
        List<StaleInterval> staleIntervals = new ArrayList<>();

        for (IntervalFreshnessSpec spec : BASE_INTERVALS) {
            Instant maxBucket = maxBucket(symbol, spec.intervalString());
            Long maxTimestamp = maxBucket != null ? OhlcTimeConverter.toEpochMs(maxBucket) : null;

            if (maxTimestamp == null) {
                staleIntervals.add(new StaleInterval(
                        spec.intervalString(), null, spec.maxLagMs(), spec.maxLagMs()));
                continue;
            }

            long cutoff = nowMs - spec.maxLagMs();
            if (maxTimestamp < cutoff) {
                long lagMs = nowMs - maxTimestamp;
                staleIntervals.add(new StaleInterval(
                        spec.intervalString(), maxTimestamp, spec.maxLagMs(), lagMs));
            }
        }

        return staleIntervals;
    }

    private Instant maxBucket(String symbol, String intervalString) {
        if ("1d".equals(intervalString)) {
            return ohlc1dRepository.findMaxBucketBySymbol(symbol);
        }
        return ohlc1mRepository.findMaxBucketBySymbol(symbol);
    }
}
