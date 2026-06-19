package com.matrix2121.cryptotrade.marketdata;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenOhlcClient;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenTradesClient;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;
import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1d;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1dRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1m;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1mRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcChartRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MarketDataSyncService {

    private static final long MS_PER_DAY = 24L * 60 * 60 * 1000L;
    private static final long MS_PER_HOUR = 60L * 60 * 1000L;
    private static final long FIVE_YEARS_MS = 5L * 365 * MS_PER_DAY;
    private static final long EIGHT_HOURS_MS = 8L * MS_PER_HOUR;
    private static final long HOURLY_BACKFILL_WINDOW_MS = 40L * MS_PER_DAY;
    private static final long HOURLY_STUB_SAFE_CUTOFF_MS = 48L * MS_PER_HOUR;
    private static final int KRAKEN_HOURLY_INTERVAL_MINUTES = 60;

    private final Ohlc1mRepository ohlc1mRepository;
    private final Ohlc1dRepository ohlc1dRepository;
    private final OhlcChartRepository ohlcChartRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final KrakenOhlcClient krakenOhlcClient;
    private final KrakenTradesClient krakenTradesClient;
    private final TrackedSymbolsService trackedSymbolsService;
    private final OhlcGapDetector gapDetector;
    private final ContinuousAggregateRefreshService caggRefreshService;
    private final AtomicBoolean syncInProgress = new AtomicBoolean(false);

    public MarketDataSyncService(
            Ohlc1mRepository ohlc1mRepository,
            Ohlc1dRepository ohlc1dRepository,
            OhlcChartRepository ohlcChartRepository,
            LiveTickCacheService liveTickCacheService,
            KrakenOhlcClient krakenOhlcClient,
            KrakenTradesClient krakenTradesClient,
            TrackedSymbolsService trackedSymbolsService,
            OhlcGapDetector gapDetector,
            ContinuousAggregateRefreshService caggRefreshService) {
        this.ohlc1mRepository = ohlc1mRepository;
        this.ohlc1dRepository = ohlc1dRepository;
        this.ohlcChartRepository = ohlcChartRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.krakenOhlcClient = krakenOhlcClient;
        this.krakenTradesClient = krakenTradesClient;
        this.trackedSymbolsService = trackedSymbolsService;
        this.gapDetector = gapDetector;
        this.caggRefreshService = caggRefreshService;
    }

    /**
     * Runs {@link #syncAll()} in the background unless a sync is already in progress.
     *
     * @param trigger source label for logs (e.g. "startup", "admin")
     * @return true if sync was started, false if another sync is already running
     */
    public boolean runSyncAsync(String trigger) {
        if (!syncInProgress.compareAndSet(false, true)) {
            log.info("Market data sync already in progress (skipped trigger={})", trigger);
            return false;
        }
        CompletableFuture.runAsync(() -> {
            try {
                log.info("Market data sync triggered by {}", trigger);
                syncAll();
            } finally {
                syncInProgress.set(false);
            }
        });
        return true;
    }

    /** Full gap-fill for 1m and 1d base hypertables across all symbols. */
    public void syncAll() {
        long syncStartMs = System.currentTimeMillis();
        List<String> symbols = trackedSymbolsService.getSymbols();
        log.info("Market data gap sync started for {} symbols", symbols.size());
        for (String symbol : symbols) {
            long symbolStartMs = System.currentTimeMillis();
            try {
                syncSymbol(symbol);
                log.info("Synced {} in {} ms", symbol, System.currentTimeMillis() - symbolStartMs);
            } catch (Exception e) {
                log.error("Sync failed for {} after {} ms: {}",
                        symbol, System.currentTimeMillis() - symbolStartMs, e.getMessage(), e);
            }
            pauseBetweenSymbols();
        }
        log.info("Market data gap sync complete for {} symbols in {} ms",
                symbols.size(), System.currentTimeMillis() - syncStartMs);
    }

    @Scheduled(cron = "0 0 0,6,12,18 * * ?")
    public void syncShortIntervals() {
        syncKrakenBaseIntervals(List.of("1m"));
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void syncDailyInterval() {
        syncKrakenBaseIntervals(List.of("1d"));
    }

    private void syncKrakenBaseIntervals(List<String> intervalNames) {
        List<OhlcIntervalPolicy.BaseIntervalSpec> specs = OhlcIntervalPolicy.krakenBaseIntervals().stream()
                .filter(spec -> intervalNames.contains(spec.name()))
                .toList();

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                for (OhlcIntervalPolicy.BaseIntervalSpec spec : specs) {
                    syncOhlcInterval(symbol, spec);
                }
                if (intervalNames.contains("1d")) {
                    syncTicks(symbol);
                }
            } catch (Exception e) {
                log.error("Kraken gap sync failed for {}: {}", symbol, e.getMessage(), e);
            }
            pauseBetweenSymbols();
        }
    }

    private void syncSymbol(String symbol) {
        for (OhlcIntervalPolicy.BaseIntervalSpec spec : OhlcIntervalPolicy.krakenBaseIntervals()) {
            try {
                syncOhlcInterval(symbol, spec);
            } catch (KrakenApiException e) {
                if (isRateLimitError(e)) {
                    log.warn(
                            "Kraken rate limit hit for {} {}. Skipping remaining intervals for this symbol.",
                            symbol, spec.name());
                    return;
                }
                log.error("OHLC gap sync failed for {} {}: {}",
                        symbol, spec.name(), e.getMessage(), e);
            } catch (Exception e) {
                log.error("OHLC gap sync failed for {} {}: {}",
                        symbol, spec.name(), e.getMessage(), e);
            }
        }

        try {
            syncTicks(symbol);
        } catch (Exception e) {
            log.error("Tick sync failed for {}: {}", symbol, e.getMessage(), e);
        }

        try {
            syncHourlyForCoarseCharts(symbol);
        } catch (KrakenApiException e) {
            if (isRateLimitError(e)) {
                log.warn("Kraken rate limit hit during hourly backfill for {}. Skipping.", symbol);
                return;
            }
            log.error("Hourly backfill failed for {}: {}", symbol, e.getMessage(), e);
        } catch (Exception e) {
            log.error("Hourly backfill failed for {}: {}", symbol, e.getMessage(), e);
        }
    }

    /**
     * Backfills missing 8-hour chart buckets for the 1M range.
     * {@code ohlc_1m} only retains 2 days, so older holes in {@code ohlc_8h} cannot
     * be healed by 1-minute gap sync alone — we fetch Kraken hourly OHLC, stage it
     * in {@code ohlc_1m}, and refresh 1m-derived continuous aggregates.
     */
    private void syncHourlyForCoarseCharts(String symbol) {
        long nowMs = System.currentTimeMillis();
        long windowStart = nowMs - HOURLY_BACKFILL_WINDOW_MS;
        long safeCutoffMs = nowMs - HOURLY_STUB_SAFE_CUTOFF_MS;

        List<Long> existing8h = ohlcChartRepository.findBucketEpochMsBetween(
                "ohlc_8h", symbol, windowStart, nowMs);
        Set<Long> existing = gapDetector.toTimestampSet(existing8h);

        List<OhlcGapDetector.TimeRange> gaps = gapDetector.findGaps(
                existing, windowStart, nowMs, EIGHT_HOURS_MS);

        if (gaps.isEmpty()) {
            log.debug("No 8h chart gaps for {} between {} and {}", symbol, windowStart, nowMs);
            return;
        }

        int inserted = 0;
        for (OhlcGapDetector.TimeRange gap : gaps) {
            long sinceSeconds = gap.startMs() / 1000L;
            List<OhlcDto> hourly = krakenOhlcClient.fetchOhlcSince(
                    symbol, KRAKEN_HOURLY_INTERVAL_MINUTES, sinceSeconds);
            List<OhlcDto> inGap = hourly.stream()
                    .filter(c -> c.timestamp() >= gap.startMs()
                            && c.timestamp() <= gap.endMs() + EIGHT_HOURS_MS)
                    .filter(c -> c.timestamp() < safeCutoffMs)
                    .toList();
            inserted += insertMissing1m(symbol, inGap);
        }

        if (inserted == 0) {
            log.info("8h chart gaps remain for {} ({} ranges) but no hourly rows inserted",
                    symbol, gaps.size());
            return;
        }

        log.info("Hourly backfill inserted {} rows for {} ({} 8h gap ranges); refreshing CAGGs",
                inserted, symbol, gaps.size());
        caggRefreshService.refreshOneMinuteDerived();
    }

    private void syncOhlcInterval(String symbol, OhlcIntervalPolicy.BaseIntervalSpec spec) {
        long nowMs = System.currentTimeMillis();
        long stepMs = OhlcIntervalPolicy.intervalStepMs(spec.name());

        if ("1d".equals(spec.name())) {
            syncDailyWithHistoryExtension(symbol, spec, nowMs, stepMs);
            return;
        }

        long windowStart = OhlcIntervalPolicy.windowStartMs(spec.name(), nowMs);
        fillGapsInWindow(symbol, spec, windowStart, nowMs, stepMs);
    }

    private void syncDailyWithHistoryExtension(
            String symbol,
            OhlcIntervalPolicy.BaseIntervalSpec spec,
            long nowMs,
            long stepMs) {

        Instant minBucket = ohlc1dRepository.findMinBucketBySymbol(symbol);
        Long minTimestamp = minBucket != null ? OhlcTimeConverter.toEpochMs(minBucket) : null;
        boolean needsBackwardExtension = minTimestamp == null
                || minTimestamp > nowMs - FIVE_YEARS_MS;

        if (needsBackwardExtension) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenIntervalMinutes(), 0L);
            insertMissing1d(symbol, fromListing.stream()
                    .filter(c -> minTimestamp == null || c.timestamp() < minTimestamp)
                    .toList());
            log.info("Extended Kraken {} history backward for {} ({} older candles)",
                    spec.name(), symbol,
                    fromListing.stream().filter(c -> minTimestamp == null || c.timestamp() < minTimestamp).count());
        }

        Instant maxBucket = ohlc1dRepository.findMaxBucketBySymbol(symbol);
        Long maxTimestamp = maxBucket != null ? OhlcTimeConverter.toEpochMs(maxBucket) : null;
        if (maxTimestamp == null) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenIntervalMinutes(), 0L);
            insertMissing1d(symbol, fromListing);
            log.info("Full Kraken {} history backfill for {} ({} candles)",
                    spec.name(), symbol, fromListing.size());
            return;
        }

        fillGapsInWindow(symbol, spec, maxTimestamp, nowMs, stepMs);
    }

    private void fillGapsInWindow(
            String symbol,
            OhlcIntervalPolicy.BaseIntervalSpec spec,
            long windowStartMs,
            long windowEndMs,
            long stepMs) {

        List<Long> existingList = findExistingBuckets(symbol, spec.name(), windowStartMs, windowEndMs);
        Set<Long> existing = gapDetector.toTimestampSet(existingList);

        List<OhlcGapDetector.TimeRange> gaps = gapDetector.findGaps(
                existing, windowStartMs, windowEndMs, stepMs);

        if (gaps.isEmpty()) {
            log.info("No {} gaps for {} between {} and {}",
                    spec.name(), symbol, windowStartMs, windowEndMs);
            return;
        }

        int inserted = 0;
        for (OhlcGapDetector.TimeRange gap : gaps) {
            long sinceSeconds = gap.startMs() / 1000L;
            List<OhlcDto> fetched = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenIntervalMinutes(), sinceSeconds);
            List<OhlcDto> inGap = fetched.stream()
                    .filter(c -> c.timestamp() >= gap.startMs() && c.timestamp() <= gap.endMs())
                    .toList();
            inserted += insertMissing(symbol, spec.name(), inGap);
        }

        log.info("Gap-filled {} {} candles for {} ({} gap ranges)",
                inserted, spec.name(), symbol, gaps.size());
    }

    private List<Long> findExistingBuckets(
            String symbol, String intervalName, long windowStartMs, long windowEndMs) {
        if ("1d".equals(intervalName)) {
            return ohlc1dRepository.findBucketEpochMsBetween(symbol, windowStartMs, windowEndMs);
        }
        return ohlc1mRepository.findBucketEpochMsBetween(symbol, windowStartMs, windowEndMs);
    }

    private int insertMissing(String symbol, String intervalName, List<OhlcDto> candles) {
        if ("1d".equals(intervalName)) {
            return insertMissing1d(symbol, candles);
        }
        return insertMissing1m(symbol, candles);
    }

    private int insertMissing1m(String symbol, List<OhlcDto> candles) {
        if (candles.isEmpty()) {
            return 0;
        }

        Map<Long, Ohlc1m> uniqueOhlc = new HashMap<>();
        for (OhlcDto candle : candles) {
            Instant bucket = OhlcTimeConverter.toInstant(candle.timestamp());
            if (!ohlc1mRepository.existsBySymbolAndBucket(symbol, bucket)) {
                uniqueOhlc.put(candle.timestamp(), to1mEntity(symbol, candle));
            }
        }

        if (uniqueOhlc.isEmpty()) {
            return 0;
        }

        List<Ohlc1m> deduped = new ArrayList<>(uniqueOhlc.values());
        deduped.sort(Comparator.comparing(Ohlc1m::getBucket));
        ohlc1mRepository.saveAll(deduped);
        ohlc1mRepository.flush();
        return deduped.size();
    }

    private int insertMissing1d(String symbol, List<OhlcDto> candles) {
        if (candles.isEmpty()) {
            return 0;
        }

        Map<Long, Ohlc1d> uniqueOhlc = new HashMap<>();
        for (OhlcDto candle : candles) {
            Instant bucket = OhlcTimeConverter.toInstant(candle.timestamp());
            if (!ohlc1dRepository.existsBySymbolAndBucket(symbol, bucket)) {
                uniqueOhlc.put(candle.timestamp(), to1dEntity(symbol, candle));
            }
        }

        if (uniqueOhlc.isEmpty()) {
            return 0;
        }

        List<Ohlc1d> deduped = new ArrayList<>(uniqueOhlc.values());
        deduped.sort(Comparator.comparing(Ohlc1d::getBucket));
        ohlc1dRepository.saveAll(deduped);
        ohlc1dRepository.flush();
        return deduped.size();
    }

    private static Ohlc1m to1mEntity(String symbol, OhlcDto candle) {
        return new Ohlc1m(
                symbol,
                OhlcTimeConverter.toInstant(candle.timestamp()),
                candle.open(),
                candle.high(),
                candle.low(),
                candle.close(),
                candle.volume());
    }

    private static Ohlc1d to1dEntity(String symbol, OhlcDto candle) {
        return new Ohlc1d(
                symbol,
                OhlcTimeConverter.toInstant(candle.timestamp()),
                candle.open(),
                candle.high(),
                candle.low(),
                candle.close(),
                candle.volume());
    }

    private void syncTicks(String symbol) {
        List<TickDto> ticks = krakenTradesClient.fetchLastTrades(symbol);
        Map<Long, TickDto> uniqueTicks = new HashMap<>();
        for (TickDto tick : ticks) {
            uniqueTicks.put(tick.timestamp(), tick);
        }
        uniqueTicks.values().forEach(t -> liveTickCacheService.addLiveTick(symbol, t));
        log.debug("Seeded {} ticks for {} into RAM cache ({} raw from Kraken)",
                uniqueTicks.size(), symbol, ticks.size());
    }

    private static boolean isRateLimitError(KrakenApiException e) {
        String msg = e.getMessage();
        return msg != null && msg.contains("Too many requests");
    }

    private static void pauseBetweenSymbols() {
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

