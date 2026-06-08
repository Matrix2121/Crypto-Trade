package com.matrix2121.cryptotrade.marketdata;

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
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcData;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MarketDataSyncService {

    private static final long MS_PER_DAY = 24L * 60 * 60 * 1000L;
    private static final long FIVE_YEARS_MS = 5L * 365 * MS_PER_DAY;

    private final OhlcDataRepository ohlcDataRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final KrakenOhlcClient krakenOhlcClient;
    private final KrakenTradesClient krakenTradesClient;
    private final TrackedSymbolsService trackedSymbolsService;
    private final TickAggregationService tickAggregationService;
    private final OhlcGapDetector gapDetector;
    private final AtomicBoolean syncInProgress = new AtomicBoolean(false);

    public MarketDataSyncService(
            OhlcDataRepository ohlcDataRepository,
            LiveTickCacheService liveTickCacheService,
            KrakenOhlcClient krakenOhlcClient,
            KrakenTradesClient krakenTradesClient,
            TrackedSymbolsService trackedSymbolsService,
            TickAggregationService tickAggregationService,
            OhlcGapDetector gapDetector) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.krakenOhlcClient = krakenOhlcClient;
        this.krakenTradesClient = krakenTradesClient;
        this.trackedSymbolsService = trackedSymbolsService;
        this.tickAggregationService = tickAggregationService;
        this.gapDetector = gapDetector;
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

    /** Full gap-fill for all Kraken-backed intervals and all symbols. */
    public void syncAll() {
        List<String> symbols = trackedSymbolsService.getSymbols();
        log.info("Market data gap sync started for {} symbols", symbols.size());
        for (String symbol : symbols) {
            try {
                syncSymbol(symbol);
                log.info("Synced {}", symbol);
            } catch (Exception e) {
                log.error("Sync failed for {}: {}", symbol, e.getMessage(), e);
            }
            pauseBetweenSymbols();
        }
        log.info("Market data gap sync complete");
    }

    @Scheduled(cron = "0 0 0,6,12,18 * * ?")
    public void syncShortIntervals() {
        syncKrakenIntervals(List.of("1m", "30m"));
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void syncDailyInterval() {
        syncKrakenIntervals(List.of("1d"));
    }

    private void syncKrakenIntervals(List<String> intervalStrings) {
        List<OhlcIntervalPolicy.IntervalSpec> specs = OhlcIntervalPolicy.krakenSyncIntervals().stream()
                .filter(spec -> intervalStrings.contains(spec.intervalString()))
                .toList();

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                for (OhlcIntervalPolicy.IntervalSpec spec : specs) {
                    syncOhlcInterval(symbol, spec);
                }
                if (intervalStrings.contains("1d")) {
                    syncTicks(symbol);
                    tickAggregationService.backfillSyntheticIntervals(symbol);
                }
            } catch (Exception e) {
                log.error("Kraken gap sync failed for {}: {}", symbol, e.getMessage(), e);
            }
            pauseBetweenSymbols();
        }
    }

    private void syncSymbol(String symbol) {
        for (OhlcIntervalPolicy.IntervalSpec spec : OhlcIntervalPolicy.krakenSyncIntervals()) {
            try {
                syncOhlcInterval(symbol, spec);
            } catch (KrakenApiException e) {
                if (isRateLimitError(e)) {
                    log.warn(
                            "Kraken rate limit hit for {} {}. Skipping remaining intervals for this symbol.",
                            symbol, spec.intervalString());
                    return;
                }
                log.error("OHLC gap sync failed for {} {}: {}",
                        symbol, spec.intervalString(), e.getMessage(), e);
            } catch (Exception e) {
                log.error("OHLC gap sync failed for {} {}: {}",
                        symbol, spec.intervalString(), e.getMessage(), e);
            }
        }

        try {
            syncTicks(symbol);
        } catch (Exception e) {
            log.error("Tick sync failed for {}: {}", symbol, e.getMessage(), e);
        }

        try {
            tickAggregationService.backfillSyntheticIntervals(symbol);
        } catch (Exception e) {
            log.error("Synthetic interval backfill failed for {}: {}", symbol, e.getMessage(), e);
        }
    }

    private void syncOhlcInterval(String symbol, OhlcIntervalPolicy.IntervalSpec spec) {
        long nowMs = System.currentTimeMillis();
        long stepMs = OhlcIntervalPolicy.intervalStepMs(spec.intervalString());

        if ("1d".equals(spec.intervalString())) {
            syncDailyWithHistoryExtension(symbol, spec, nowMs, stepMs);
            return;
        }

        long windowStart = OhlcIntervalPolicy.windowStartMs(spec.intervalString(), nowMs);
        fillGapsInWindow(symbol, spec, windowStart, nowMs, stepMs);
    }

    private void syncDailyWithHistoryExtension(String symbol, OhlcIntervalPolicy.IntervalSpec spec, long nowMs, long stepMs) {
        Long minTimestamp = ohlcDataRepository.findMinTimestampBySymbolAndIntervalString(
                symbol, spec.intervalString());
        boolean needsBackwardExtension = minTimestamp == null
                || minTimestamp > nowMs - FIVE_YEARS_MS;

        if (needsBackwardExtension) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenIntervalMinutes(), 0L);
            insertMissingOnly(symbol, spec.intervalString(), fromListing.stream()
                    .filter(c -> minTimestamp == null || c.timestamp() < minTimestamp)
                    .toList());
            log.info("Extended Kraken {} history backward for {} ({} older candles)",
                    spec.intervalString(), symbol,
                    fromListing.stream().filter(c -> minTimestamp == null || c.timestamp() < minTimestamp).count());
        }

        Long maxTimestamp = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                symbol, spec.intervalString());
        if (maxTimestamp == null) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenIntervalMinutes(), 0L);
            insertMissingOnly(symbol, spec.intervalString(), fromListing);
            log.info("Full Kraken {} history backfill for {} ({} candles)",
                    spec.intervalString(), symbol, fromListing.size());
            return;
        }

        fillGapsInWindow(symbol, spec, maxTimestamp, nowMs, stepMs);
    }

    private void fillGapsInWindow(
            String symbol,
            OhlcIntervalPolicy.IntervalSpec spec,
            long windowStartMs,
            long windowEndMs,
            long stepMs) {

        List<Long> existingList = ohlcDataRepository
                .findTimestampsBySymbolAndIntervalAndTimestampBetween(
                        symbol, spec.intervalString(), windowStartMs, windowEndMs);
        Set<Long> existing = gapDetector.toTimestampSet(existingList);

        List<OhlcGapDetector.TimeRange> gaps = gapDetector.findGaps(
                existing, windowStartMs, windowEndMs, stepMs);

        if (gaps.isEmpty()) {
            log.debug("No {} gaps for {} between {} and {}",
                    spec.intervalString(), symbol, windowStartMs, windowEndMs);
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
            inserted += insertMissingOnly(symbol, spec.intervalString(), inGap);
        }

        log.debug("Gap-filled {} {} candles for {} ({} gap ranges)",
                inserted, spec.intervalString(), symbol, gaps.size());
    }

    private int insertMissingOnly(String symbol, String intervalString, List<OhlcDto> candles) {
        if (candles.isEmpty()) {
            return 0;
        }

        Map<Long, OhlcData> uniqueOhlc = new HashMap<>();
        for (OhlcDto candle : candles) {
            if (!ohlcDataRepository.existsBySymbolAndIntervalStringAndTimestamp(
                    symbol, intervalString, candle.timestamp())) {
                uniqueOhlc.put(candle.timestamp(), toEntity(symbol, intervalString, candle));
            }
        }

        if (uniqueOhlc.isEmpty()) {
            return 0;
        }

        List<OhlcData> deduped = new ArrayList<>(uniqueOhlc.values());
        deduped.sort(Comparator.comparingLong(OhlcData::getTimestamp));
        ohlcDataRepository.saveAll(deduped);
        ohlcDataRepository.flush();
        return deduped.size();
    }

    private static OhlcData toEntity(String symbol, String intervalString, OhlcDto candle) {
        return new OhlcData(
                symbol,
                intervalString,
                candle.timestamp(),
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
