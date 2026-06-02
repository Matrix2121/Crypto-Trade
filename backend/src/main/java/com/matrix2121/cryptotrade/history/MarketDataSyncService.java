package com.matrix2121.cryptotrade.history;

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

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MarketDataSyncService {

    static final List<String> TRACKED_SYMBOLS = List.of(
            "BTC/USD", "ETH/USD", "XRP/USD", "USDT/USD", "BNB/USD",
            "SOL/USD", "USDC/USD", "DOGE/USD", "TRX/USD", "ADA/USD",
            "WBTC/USD", "XLM/USD", "SUI/USD", "LINK/USD", "HBAR/USD",
            "BCH/USD", "AVAX/USD", "SHIB/USD", "TON/USD", "LTC/USD");

    private record IntervalSpec(int krakenInterval, String intervalString, long lookbackDays) {}

    private static final List<IntervalSpec> INTERVALS = List.of(
            new IntervalSpec(1440, "1d",  5 * 365L),
            new IntervalSpec(240,  "4h",  90L),
            new IntervalSpec(60,   "1h",  30L),
            new IntervalSpec(5,    "5m",  1L));

    private final OhlcDataRepository ohlcDataRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final KrakenOhlcClient krakenOhlcClient;
    private final KrakenTradesClient krakenTradesClient;

    public MarketDataSyncService(
            OhlcDataRepository ohlcDataRepository,
            LiveTickCacheService liveTickCacheService,
            KrakenOhlcClient krakenOhlcClient,
            KrakenTradesClient krakenTradesClient) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.krakenOhlcClient = krakenOhlcClient;
        this.krakenTradesClient = krakenTradesClient;
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void syncAll() {
        log.info("Market data sync started for {} symbols", TRACKED_SYMBOLS.size());
        for (String symbol : TRACKED_SYMBOLS) {
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
    }

    private void syncOhlcInterval(String symbol, IntervalSpec spec) {
        Long maxTimestamp = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                symbol, spec.intervalString());

        List<OhlcDto> candles;
        if (maxTimestamp != null) {
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
     * Seeds the in-memory tick cache with the most recent Kraken trades for this symbol.
     * Replaces whatever was previously in the cache so the window always reflects the
     * freshest data available at sync time.
     */
    private void syncTicks(String symbol) {
        List<TickDto> ticks = krakenTradesClient.fetchLastTrades(symbol);
        // Deduplicate by timestamp before seeding (Kraken can return duplicate timestamps).
        Map<Long, TickDto> uniqueTicks = new HashMap<>();
        for (TickDto tick : ticks) {
            uniqueTicks.put(tick.timestamp(), tick);
        }
        uniqueTicks.values().forEach(t -> liveTickCacheService.addLiveTick(symbol, t));
        log.debug("Seeded {} ticks for {} into RAM cache ({} raw from Kraken)",
                uniqueTicks.size(), symbol, ticks.size());
    }

    /**
     * Merges incoming candles without wiping historical rows.
     * Replaces only timestamps present in the incoming payload.
     */
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
