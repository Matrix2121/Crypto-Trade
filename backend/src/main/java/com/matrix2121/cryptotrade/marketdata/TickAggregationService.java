package com.matrix2121.cryptotrade.marketdata;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.marketdata.dto.TickDto;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcData;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * Cascading OHLC aggregator.
 *
 * <pre>
 * Every 1 min   : LiveTickCacheService (RAM) → ohlc_data ("1m")
 * Every 30 min  : "1m"  → "30m"
 * Every 1 hour  : "30m" → "1h"
 * Every 2 hours : "1h"  → "2h"
 * Every 4 hours : "1h"  → "4h"
 * Every 8 hours : "4h"  → "8h"
 * Every 24 hours: "1d" (Kraken) → "5d" and "1mo"
 *
 * Live chain: ticks → 1m → 30m → 1h → 2h
 *                              └→ 4h → 8h
 * </pre>
 */
@Slf4j
@Service
public class TickAggregationService {

    private static final long ONE_MIN_MS = 60_000L;
    private static final long THIRTY_MIN_MS = 30L * ONE_MIN_MS;
    private static final long MS_PER_HOUR = 60L * 60 * 1_000;
    private static final long TWO_HOUR_MS = 2L * MS_PER_HOUR;
    private static final long FOUR_HOUR_MS = 4L * MS_PER_HOUR;
    private static final long EIGHT_HOUR_MS = 8L * MS_PER_HOUR;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;
    private static final long FIVE_DAY_MS = 5L * MS_PER_DAY;
    private static final long ONE_MONTH_MS = 30L * MS_PER_DAY;

    private static final List<SyntheticSpec> SYNTHETIC_SPECS = List.of(
            new SyntheticSpec("30m", "1h", MS_PER_HOUR),
            new SyntheticSpec("1h", "2h", TWO_HOUR_MS),
            new SyntheticSpec("1h", "4h", FOUR_HOUR_MS),
            new SyntheticSpec("4h", "8h", EIGHT_HOUR_MS),
            new SyntheticSpec("1d", "5d", FIVE_DAY_MS),
            new SyntheticSpec("1d", "1mo", ONE_MONTH_MS));

    private record SyntheticSpec(String sourceInterval, String targetInterval, long windowMs) {}

    private final OhlcDataRepository ohlcDataRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final TrackedSymbolsService trackedSymbolsService;

    public TickAggregationService(
            OhlcDataRepository ohlcDataRepository,
            LiveTickCacheService liveTickCacheService,
            TrackedSymbolsService trackedSymbolsService) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    @Scheduled(cron = "0 * * * * ?")
    @Transactional
    public void aggregate1m() {
        long now = System.currentTimeMillis();
        long start = now - ONE_MIN_MS;

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                List<TickDto> windowTicks =
                        liveTickCacheService.getTicksInWindow(symbol, start, now);
                if (windowTicks.isEmpty()) {
                    continue;
                }
                List<OhlcData> candles =
                        buildCandlesFromTicks(symbol, "1m", ONE_MIN_MS, windowTicks);
                upsertOhlcCandles(symbol, "1m", candles);
                log.debug("1m: {} candles for {}", candles.size(), symbol);
            } catch (Exception e) {
                log.error("1m aggregation failed for {}: {}", symbol, e.getMessage(), e);
            }
        }
    }

    @Scheduled(cron = "0 0/30 * * * ?")
    @Transactional
    public void aggregate30m() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("1m", "30m", THIRTY_MIN_MS, now - THIRTY_MIN_MS, now);
    }

    @Scheduled(cron = "0 5 * * * ?")
    @Transactional
    public void aggregate1h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("30m", "1h", MS_PER_HOUR, now - MS_PER_HOUR, now);
    }

    @Scheduled(cron = "0 10 0/2 * * ?")
    @Transactional
    public void aggregate2h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("1h", "2h", TWO_HOUR_MS, now - TWO_HOUR_MS, now);
    }

    @Scheduled(cron = "0 15 0/4 * * ?")
    @Transactional
    public void aggregate4h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("1h", "4h", FOUR_HOUR_MS, now - FOUR_HOUR_MS, now);
    }

    @Scheduled(cron = "0 20 0/8 * * ?")
    @Transactional
    public void aggregate8h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("4h", "8h", EIGHT_HOUR_MS, now - EIGHT_HOUR_MS, now);
    }

    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void aggregate5dAnd1mo() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("1d", "5d", FIVE_DAY_MS, now - FIVE_DAY_MS, now);
        aggregateOhlcFromOhlc("1d", "1mo", ONE_MONTH_MS, now - ONE_MONTH_MS, now);
    }

    @Transactional
    public void backfillSyntheticIntervals(String symbol) {
        for (SyntheticSpec spec : SYNTHETIC_SPECS) {
            try {
                backfillSyntheticInterval(symbol, spec);
            } catch (Exception e) {
                log.error("Synthetic backfill failed for {} {}: {}",
                        symbol, spec.targetInterval(), e.getMessage(), e);
            }
        }
    }

    private void backfillSyntheticInterval(String symbol, SyntheticSpec spec) {
        Long sourceMax = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                symbol, spec.sourceInterval());
        if (sourceMax == null) {
            log.debug("No {} source data for {} — skipping {} backfill",
                    spec.sourceInterval(), symbol, spec.targetInterval());
            return;
        }

        Long targetMax = ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(
                symbol, spec.targetInterval());
        if (targetMax != null && targetMax >= sourceMax) {
            log.debug("{} already up to date for {}", spec.targetInterval(), symbol);
            return;
        }

        long since = 0L;
        if (targetMax != null) {
            since = Math.max(0L, targetMax - spec.windowMs());
        }

        List<OhlcData> source = ohlcDataRepository
                .findBySymbolAndIntervalStringAndTimestampGreaterThanEqualOrderByTimestampAsc(
                        symbol, spec.sourceInterval(), since);
        if (source.isEmpty()) {
            return;
        }

        List<OhlcData> candles = buildCandlesFromOhlc(
                symbol, spec.targetInterval(), spec.windowMs(), source);
        if (candles.isEmpty()) {
            return;
        }

        long minTs = candles.get(0).getTimestamp();
        long maxTs = candles.get(candles.size() - 1).getTimestamp();
        upsertOhlcCandles(symbol, spec.targetInterval(), candles);

        log.info("Backfilled {} {} candles for {} from {} ({} → {})",
                candles.size(), spec.targetInterval(), symbol, spec.sourceInterval(),
                minTs, maxTs);
    }

    private void aggregateOhlcFromOhlc(
            String sourceInterval,
            String targetInterval,
            long targetWindowMs,
            long since,
            long now) {

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                List<OhlcData> source = ohlcDataRepository
                        .findBySymbolAndIntervalStringAndTimestampBetweenOrderByTimestampAsc(
                                symbol, sourceInterval, since, now);
                if (source.isEmpty()) {
                    continue;
                }
                List<OhlcData> candles =
                        buildCandlesFromOhlc(symbol, targetInterval, targetWindowMs, source);
                upsertOhlcCandles(symbol, targetInterval, candles);
                log.debug("{}: {} candles for {} from {} source rows",
                        targetInterval, candles.size(), symbol, source.size());
            } catch (Exception e) {
                log.error("{} aggregation failed for {}: {}",
                        targetInterval, symbol, e.getMessage(), e);
            }
        }
    }

    private List<OhlcData> buildCandlesFromTicks(
            String symbol, String intervalString, long windowMs, List<TickDto> ticks) {

        Map<Long, List<TickDto>> byWindow = ticks.stream()
                .collect(Collectors.groupingBy(
                        t -> Math.floorDiv(t.timestamp(), windowMs) * windowMs));

        return byWindow.entrySet().stream()
                .map(e -> buildTickCandle(symbol, intervalString, e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(OhlcData::getTimestamp))
                .toList();
    }

    private OhlcData buildTickCandle(
            String symbol, String intervalString, long windowStart, List<TickDto> ticks) {

        BigDecimal open = ticks.stream()
                .min(Comparator.comparingLong(TickDto::timestamp))
                .map(TickDto::price).orElseThrow();
        BigDecimal close = ticks.stream()
                .max(Comparator.comparingLong(TickDto::timestamp))
                .map(TickDto::price).orElseThrow();
        BigDecimal high = ticks.stream()
                .map(TickDto::price).max(BigDecimal::compareTo).orElseThrow();
        BigDecimal low = ticks.stream()
                .map(TickDto::price).min(BigDecimal::compareTo).orElseThrow();

        BigDecimal volume = BigDecimal.valueOf(ticks.size());
        return new OhlcData(symbol, intervalString, windowStart, open, high, low, close, volume);
    }

    private List<OhlcData> buildCandlesFromOhlc(
            String symbol, String targetInterval, long windowMs, List<OhlcData> source) {

        Map<Long, List<OhlcData>> byWindow = source.stream()
                .collect(Collectors.groupingBy(
                        o -> Math.floorDiv(o.getTimestamp(), windowMs) * windowMs));

        return byWindow.entrySet().stream()
                .map(e -> buildOhlcCandle(symbol, targetInterval, e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(OhlcData::getTimestamp))
                .toList();
    }

    private OhlcData buildOhlcCandle(
            String symbol, String targetInterval, long windowStart, List<OhlcData> source) {

        OhlcData first = source.stream()
                .min(Comparator.comparingLong(OhlcData::getTimestamp)).orElseThrow();
        OhlcData last = source.stream()
                .max(Comparator.comparingLong(OhlcData::getTimestamp)).orElseThrow();

        BigDecimal high = source.stream()
                .map(OhlcData::getHigh).max(BigDecimal::compareTo).orElseThrow();
        BigDecimal low = source.stream()
                .map(OhlcData::getLow).min(BigDecimal::compareTo).orElseThrow();
        BigDecimal volume = source.stream()
                .map(OhlcData::getVolume)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new OhlcData(
                symbol, targetInterval, windowStart,
                first.getOpen(), high, low, last.getClose(), volume);
    }

    private void upsertOhlcCandles(String symbol, String intervalString, List<OhlcData> incoming) {
        if (incoming.isEmpty()) {
            return;
        }

        Map<Long, OhlcData> deduped = new HashMap<>();
        for (OhlcData candle : incoming) {
            deduped.put(candle.getTimestamp(), candle);
        }

        List<OhlcData> sorted = new ArrayList<>(deduped.values());
        sorted.sort(Comparator.comparingLong(OhlcData::getTimestamp));

        for (OhlcData candle : sorted) {
            ohlcDataRepository
                    .findBySymbolAndIntervalStringAndTimestamp(
                            symbol, intervalString, candle.getTimestamp())
                    .ifPresent(existing -> {
                        ohlcDataRepository.delete(existing);
                        ohlcDataRepository.flush();
                    });
            ohlcDataRepository.save(candle);
        }
        ohlcDataRepository.flush();
    }
}
