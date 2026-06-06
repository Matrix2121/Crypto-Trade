package com.matrix2121.cryptotrade.marketdata;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    private record IntervalSpec(int krakenInterval, String intervalString, Long lookbackDays) {}

    private static final long MS_PER_DAY = 24L * 60 * 60 * 1000L;
    private static final long FIVE_YEARS_MS = 5L * 365 * MS_PER_DAY;

    private static final List<IntervalSpec> INTERVALS = List.of(
            new IntervalSpec(1440, "1d",  null),
            new IntervalSpec(240,  "4h",  90L),
            new IntervalSpec(60,   "1h",  30L),
            new IntervalSpec(30,   "30m", 7L),
            new IntervalSpec(1,    "1m",  2L));

    private final OhlcDataRepository ohlcDataRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final KrakenOhlcClient krakenOhlcClient;
    private final KrakenTradesClient krakenTradesClient;
    private final TrackedSymbolsService trackedSymbolsService;
    private final TickAggregationService tickAggregationService;

    public MarketDataSyncService(
            OhlcDataRepository ohlcDataRepository,
            LiveTickCacheService liveTickCacheService,
            KrakenOhlcClient krakenOhlcClient,
            KrakenTradesClient krakenTradesClient,
            TrackedSymbolsService trackedSymbolsService,
            TickAggregationService tickAggregationService) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.krakenOhlcClient = krakenOhlcClient;
        this.krakenTradesClient = krakenTradesClient;
        this.trackedSymbolsService = trackedSymbolsService;
        this.tickAggregationService = tickAggregationService;
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void syncAll() {
        List<String> symbols = trackedSymbolsService.getSymbols();
        log.info("Market data sync started for {} symbols", symbols.size());
        for (String symbol : symbols) {
            try {
                syncSymbol(symbol);
                log.info("Synced {}", symbol);
            } catch (Exception e) {
                log.error("Sync failed for {}: {}", symbol, e.getMessage(), e);
            }
            pauseBetweenSymbols();
        }
        log.info("Market data sync complete");
    }

    private void syncSymbol(String symbol) {
        for (IntervalSpec spec : INTERVALS) {
            try {
                syncOhlcInterval(symbol, spec);
            } catch (KrakenApiException e) {
                if (isRateLimitError(e)) {
                    log.warn(
                            "Kraken rate limit hit for {} {}. Skipping remaining intervals for this symbol.",
                            symbol, spec.intervalString());
                    return;
                }
                log.error("OHLC sync failed for {} {}: {}",
                        symbol, spec.intervalString(), e.getMessage(), e);
            } catch (Exception e) {
                log.error("OHLC sync failed for {} {}: {}",
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

    private void syncOhlcInterval(String symbol, IntervalSpec spec) {
        Long maxTimestamp = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                symbol, spec.intervalString());

        List<OhlcDto> candles;
        if (spec.lookbackDays() == null) {
            candles = syncFullKrakenHistory(symbol, spec, maxTimestamp);
        } else if (maxTimestamp != null) {
            candles = krakenOhlcClient.fetchOhlc(symbol, spec.krakenInterval(), maxTimestamp);
            log.debug("Incremental OHLC sync for {} {} since {}",
                    symbol, spec.intervalString(), maxTimestamp);
        } else {
            long sinceSeconds = Instant.now()
                    .minus(spec.lookbackDays(), ChronoUnit.DAYS)
                    .getEpochSecond();
            candles = krakenOhlcClient.fetchOhlcSince(symbol, spec.krakenInterval(), sinceSeconds);
            log.debug("Full OHLC backfill for {} {} ({} day lookback)",
                    symbol, spec.intervalString(), spec.lookbackDays());
        }

        if (candles.isEmpty()) {
            log.debug("No new {} candles for {}", spec.intervalString(), symbol);
            return;
        }

        List<OhlcData> entities = candles.stream()
                .map(c -> new OhlcData(
                        symbol,
                        spec.intervalString(),
                        c.timestamp(),
                        c.open(),
                        c.high(),
                        c.low(),
                        c.close()))
                .toList();

        Map<Long, OhlcData> uniqueOhlc = new HashMap<>();
        for (OhlcData data : entities) {
            uniqueOhlc.put(data.getTimestamp(), data);
        }
        List<OhlcData> deduped = new ArrayList<>(uniqueOhlc.values());
        deduped.sort(Comparator.comparingLong(OhlcData::getTimestamp));

        upsertOhlcCandles(symbol, spec.intervalString(), deduped);

        log.debug("Saved {} {} candles for {} ({} raw from Kraken)",
                deduped.size(), spec.intervalString(), symbol, entities.size());
    }

    /**
     * Fetches daily candles from Kraken listing through now. Extends backward when
     * the DB only has a partial window (e.g. prior 5-year cap), then appends new
     * candles since the latest stored timestamp.
     */
    private List<OhlcDto> syncFullKrakenHistory(String symbol, IntervalSpec spec, Long maxTimestamp) {
        Map<Long, OhlcDto> merged = new HashMap<>();

        Long minTimestamp = ohlcDataRepository.findMinTimestampBySymbolAndIntervalString(
                symbol, spec.intervalString());
        boolean needsBackwardExtension = minTimestamp == null
                || minTimestamp > System.currentTimeMillis() - FIVE_YEARS_MS;

        if (needsBackwardExtension) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenInterval(), 0L);
            for (OhlcDto candle : fromListing) {
                if (minTimestamp == null || candle.timestamp() < minTimestamp) {
                    merged.put(candle.timestamp(), candle);
                }
            }
            log.info("Extended Kraken {} history backward for {} ({} older candles)",
                    spec.intervalString(), symbol, merged.size());
        }

        if (maxTimestamp != null) {
            for (OhlcDto candle : krakenOhlcClient.fetchOhlc(
                    symbol, spec.krakenInterval(), maxTimestamp)) {
                merged.put(candle.timestamp(), candle);
            }
        } else if (merged.isEmpty()) {
            List<OhlcDto> fromListing = krakenOhlcClient.fetchOhlcSince(
                    symbol, spec.krakenInterval(), 0L);
            for (OhlcDto candle : fromListing) {
                merged.put(candle.timestamp(), candle);
            }
            log.info("Full Kraken {} history backfill for {} ({} candles)",
                    spec.intervalString(), symbol, merged.size());
        }

        return merged.values().stream()
                .sorted(Comparator.comparingLong(OhlcDto::timestamp))
                .toList();
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

    private void upsertOhlcCandles(
            String symbol, String intervalString, List<OhlcData> incoming) {
        if (incoming.isEmpty()) {
            return;
        }

        long minIncomingTs = incoming.get(0).getTimestamp();
        Set<Long> incomingTimestamps = new HashSet<>();
        for (OhlcData candle : incoming) {
            incomingTimestamps.add(candle.getTimestamp());
        }

        List<OhlcData> existing = ohlcDataRepository
                .findBySymbolAndIntervalStringAndTimestampGreaterThanEqualOrderByTimestampAsc(
                        symbol, intervalString, minIncomingTs);
        List<OhlcData> toReplace = existing.stream()
                .filter(row -> incomingTimestamps.contains(row.getTimestamp()))
                .toList();
        if (!toReplace.isEmpty()) {
            ohlcDataRepository.deleteAll(toReplace);
            ohlcDataRepository.flush();
        }

        ohlcDataRepository.saveAll(incoming);
        ohlcDataRepository.flush();
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
