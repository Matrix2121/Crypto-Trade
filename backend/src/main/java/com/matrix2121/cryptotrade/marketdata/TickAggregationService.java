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
 * Every 5 min  : LiveTickCacheService (RAM) → ohlc_data (interval "5m")
 * Every 1 hour : ohlc_data "5m"   → ohlc_data "1h"
 * Every 6 hours: ohlc_data "1h"   → ohlc_data "6h"
 * Every 24 hours: ohlc_data "6h"  → ohlc_data "1d"
 * </pre>
 */
@Slf4j
@Service
public class TickAggregationService {

    private static final long FIVE_MIN_MS = 5L * 60 * 1_000;
    private static final long MS_PER_HOUR = 60L * 60 * 1_000;
    private static final long SIX_HOUR_MS =  6L * MS_PER_HOUR;
    private static final long MS_PER_DAY  = 24L * MS_PER_HOUR;

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

    @Scheduled(cron = "0 0/5 * * * ?")
    @Transactional
    public void aggregate5m() {
        long now   = System.currentTimeMillis();
        long start = now - FIVE_MIN_MS;

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                List<TickDto> windowTicks =
                        liveTickCacheService.getTicksInWindow(symbol, start, now);
                if (windowTicks.isEmpty()) {
                    continue;
                }
                List<OhlcData> candles =
                        buildCandlesFromTicks(symbol, "5m", FIVE_MIN_MS, windowTicks);
                replaceOhlcInRange(symbol, "5m", start, now, candles);
                log.debug("5m: {} candles for {}", candles.size(), symbol);
            } catch (Exception e) {
                log.error("5m aggregation failed for {}: {}", symbol, e.getMessage(), e);
            }
        }
    }

    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void aggregate1h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("5m", "1h", MS_PER_HOUR, now - MS_PER_HOUR, now);
    }

    @Scheduled(cron = "0 0 0/6 * * ?")
    @Transactional
    public void aggregate6h() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("1h", "6h", SIX_HOUR_MS, now - SIX_HOUR_MS, now);
    }

    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void aggregate1d() {
        long now = System.currentTimeMillis();
        aggregateOhlcFromOhlc("6h", "1d", MS_PER_DAY, now - MS_PER_DAY, now);
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
                replaceOhlcInRange(symbol, targetInterval, since, now, candles);
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

        return new OhlcData(symbol, intervalString, windowStart, open, high, low, close);
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

        return new OhlcData(
                symbol, targetInterval, windowStart,
                first.getOpen(), high, low, last.getClose());
    }

    private void replaceOhlcInRange(
            String symbol, String intervalString, long startMs, long endMs,
            List<OhlcData> candles) {

        List<OhlcData> existing = ohlcDataRepository
                .findBySymbolAndIntervalStringAndTimestampGreaterThanEqualOrderByTimestampAsc(
                        symbol, intervalString, startMs);
        List<OhlcData> toRemove = existing.stream()
                .filter(r -> r.getTimestamp() <= endMs)
                .toList();
        if (!toRemove.isEmpty()) {
            ohlcDataRepository.deleteAll(toRemove);
            ohlcDataRepository.flush();
        }

        Map<Long, OhlcData> deduped = new HashMap<>();
        for (OhlcData candle : candles) {
            deduped.put(candle.getTimestamp(), candle);
        }

        List<OhlcData> sorted = new ArrayList<>(deduped.values());
        sorted.sort(Comparator.comparingLong(OhlcData::getTimestamp));
        ohlcDataRepository.saveAll(sorted);
        ohlcDataRepository.flush();
    }
}
