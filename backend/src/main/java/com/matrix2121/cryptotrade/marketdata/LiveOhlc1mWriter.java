package com.matrix2121.cryptotrade.marketdata;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.marketdata.dto.TickDto;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1m;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1mRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcBucketId;

import lombok.extern.slf4j.Slf4j;

/**
 * Upserts the active 1-minute bucket from WebSocket ticks into {@code ohlc_1m}.
 */
@Slf4j
@Service
public class LiveOhlc1mWriter {

    private static final long ONE_MIN_MS = 60_000L;

    private final Ohlc1mRepository ohlc1mRepository;
    private final LiveTickCacheService liveTickCacheService;
    private final TrackedSymbolsService trackedSymbolsService;

    public LiveOhlc1mWriter(
            Ohlc1mRepository ohlc1mRepository,
            LiveTickCacheService liveTickCacheService,
            TrackedSymbolsService trackedSymbolsService) {
        this.ohlc1mRepository = ohlc1mRepository;
        this.liveTickCacheService = liveTickCacheService;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    @Scheduled(cron = "0 * * * * ?")
    @Transactional
    public void writeActiveMinute() {
        long now = System.currentTimeMillis();
        long start = now - ONE_MIN_MS;

        for (String symbol : trackedSymbolsService.getSymbols()) {
            try {
                List<TickDto> windowTicks = liveTickCacheService.getTicksInWindow(symbol, start, now);
                if (windowTicks.isEmpty()) {
                    continue;
                }
                List<Ohlc1m> candles = buildCandlesFromTicks(symbol, ONE_MIN_MS, windowTicks);
                upsertCandles(symbol, candles);
                log.debug("1m: {} candles for {}", candles.size(), symbol);
            } catch (Exception e) {
                log.error("1m live write failed for {}: {}", symbol, e.getMessage(), e);
            }
        }
    }

    private List<Ohlc1m> buildCandlesFromTicks(String symbol, long windowMs, List<TickDto> ticks) {
        Map<Long, List<TickDto>> byWindow = ticks.stream()
                .collect(Collectors.groupingBy(
                        t -> Math.floorDiv(t.timestamp(), windowMs) * windowMs));

        return byWindow.entrySet().stream()
                .map(e -> buildTickCandle(symbol, e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(Ohlc1m::getBucket))
                .toList();
    }

    private Ohlc1m buildTickCandle(String symbol, long windowStartMs, List<TickDto> ticks) {
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

        return new Ohlc1m(
                symbol,
                OhlcTimeConverter.toInstant(windowStartMs),
                open,
                high,
                low,
                close,
                volume);
    }

    private void upsertCandles(String symbol, List<Ohlc1m> incoming) {
        if (incoming.isEmpty()) {
            return;
        }

        Map<Instant, Ohlc1m> deduped = new HashMap<>();
        for (Ohlc1m candle : incoming) {
            deduped.put(candle.getBucket(), candle);
        }

        List<Ohlc1m> sorted = deduped.values().stream()
                .sorted(Comparator.comparing(Ohlc1m::getBucket))
                .toList();

        for (Ohlc1m candle : sorted) {
            ohlc1mRepository.findById(new OhlcBucketId(symbol, candle.getBucket()))
                    .ifPresent(existing -> {
                        ohlc1mRepository.delete(existing);
                        ohlc1mRepository.flush();
                    });
            ohlc1mRepository.save(candle);
        }
        ohlc1mRepository.flush();
    }
}
