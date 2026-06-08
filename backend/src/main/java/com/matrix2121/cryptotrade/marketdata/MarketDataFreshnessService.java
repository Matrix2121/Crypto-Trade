package com.matrix2121.cryptotrade.marketdata;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

/**
 * Evaluates whether stored OHLC intervals are fresh enough for chart serving.
 */
@Service
public class MarketDataFreshnessService {

    private static final long MS_PER_HOUR = 60L * 60 * 1_000L;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;

    record IntervalFreshnessSpec(String intervalString, long maxLagMs) {}

    private static final List<IntervalFreshnessSpec> CHART_INTERVALS = List.of(
            new IntervalFreshnessSpec("1h", 36L * MS_PER_HOUR),
            new IntervalFreshnessSpec("2h", 4L * MS_PER_HOUR),
            new IntervalFreshnessSpec("8h", 16L * MS_PER_HOUR),
            new IntervalFreshnessSpec("1d", 36L * MS_PER_HOUR),
            new IntervalFreshnessSpec("5d", 7L * MS_PER_DAY),
            new IntervalFreshnessSpec("1mo", 35L * MS_PER_DAY));

    private final OhlcDataRepository ohlcDataRepository;
    private final TrackedSymbolsService trackedSymbolsService;

    public MarketDataFreshnessService(
            OhlcDataRepository ohlcDataRepository,
            TrackedSymbolsService trackedSymbolsService) {
        this.ohlcDataRepository = ohlcDataRepository;
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

        for (IntervalFreshnessSpec spec : CHART_INTERVALS) {
            Long maxTimestamp = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                    symbol, spec.intervalString());

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
}
