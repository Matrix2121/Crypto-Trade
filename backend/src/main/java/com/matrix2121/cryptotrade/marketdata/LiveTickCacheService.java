package com.matrix2121.cryptotrade.marketdata;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentNavigableMap;
import java.util.concurrent.ConcurrentSkipListMap;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;

/**
 * Pure in-memory store for the rolling 15-minute tick window and derived 15-second OHLC candles.
 * All mutations are performed via ConcurrentSkipListMap.compute() which gives lock-free
 * compare-and-swap atomicity per key. No DB I/O — data lives only in RAM and is pruned
 * automatically on each incoming tick.
 */
@Service
public class LiveTickCacheService {

    private static final long WINDOW_MS  = 15 * 60 * 1_000L; // 15-minute rolling window
    private static final long BUCKET_MS  = 15_000L;           // 15-second candle buckets

    /** symbol → (timestampMs → TickDto), ordered by time for O(log n) range queries. */
    private final Map<String, ConcurrentNavigableMap<Long, TickDto>> tickCache =
            new ConcurrentHashMap<>();

    /** symbol → (bucketStartMs → OhlcDto), ordered by time. */
    private final Map<String, ConcurrentNavigableMap<Long, OhlcDto>> candle15sCache =
            new ConcurrentHashMap<>();

    public void addLiveTick(String symbol, TickDto tick) {
        long ts = tick.timestamp();

        tickCache.computeIfAbsent(symbol, k -> new ConcurrentSkipListMap<>())
                 .put(ts, tick);

        long bucket = (ts / BUCKET_MS) * BUCKET_MS;
        candle15sCache.computeIfAbsent(symbol, k -> new ConcurrentSkipListMap<>())
                      .compute(bucket, (k, existing) -> {
                          BigDecimal price = tick.price();
                          if (existing == null) {
                              return new OhlcDto(bucket, price, price, price, price);
                          }
                          return new OhlcDto(
                                  bucket,
                                  existing.open(),
                                  existing.high().max(price),
                                  existing.low().min(price),
                                  price);
                      });

        long cutoff = System.currentTimeMillis() - WINDOW_MS;

        ConcurrentNavigableMap<Long, TickDto> ticks = tickCache.get(symbol);
        if (ticks != null) {
            ticks.headMap(cutoff).clear();
        }

        ConcurrentNavigableMap<Long, OhlcDto> candles = candle15sCache.get(symbol);
        if (candles != null) {
            candles.headMap(cutoff).clear();
        }
    }

    public List<TickDto> getTicksInWindow(String symbol, long start, long end) {
        ConcurrentNavigableMap<Long, TickDto> map = tickCache.get(symbol);
        if (map == null) {
            return List.of();
        }
        return new ArrayList<>(map.subMap(start, end).values());
    }

    public List<TickDto> getAllTicks(String symbol) {
        ConcurrentNavigableMap<Long, TickDto> map = tickCache.get(symbol);
        if (map == null) {
            return List.of();
        }
        return new ArrayList<>(map.values());
    }

    public List<OhlcDto> getCandles15s(String symbol) {
        ConcurrentNavigableMap<Long, OhlcDto> map = candle15sCache.get(symbol);
        if (map == null) {
            return List.of();
        }
        return new ArrayList<>(map.values());
    }
}
