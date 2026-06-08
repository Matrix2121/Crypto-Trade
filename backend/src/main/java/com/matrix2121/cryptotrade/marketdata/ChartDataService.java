package com.matrix2121.cryptotrade.marketdata;

import java.util.List;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class ChartDataService {

    private static final long MS_PER_HOUR = 60L * 60_000L;
    private static final long MS_PER_DAY  = 24L * MS_PER_HOUR;

    private final OhlcDataRepository ohlcDataRepository;
    private final LiveTickCacheService liveTickCacheService;

    public ChartDataService(
            OhlcDataRepository ohlcDataRepository,
            LiveTickCacheService liveTickCacheService) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.liveTickCacheService = liveTickCacheService;
    }

    public boolean isKnownRange(String range) {
        return switch (range) {
            case "1Min", "5Min", "15Min", "1H", "1D", "1W", "1M", "3M", "1Y", "5Y", "ALL" -> true;
            default -> false;
        };
    }

    public List<Object> getByRange(String symbol, String range) {
        long nowMs = System.currentTimeMillis();

        return switch (range) {
            case "1Min"  -> toObjectList(fetchTicks(symbol, nowMs - 60_000L,          nowMs));
            case "5Min"  -> toObjectList(fetchTicks(symbol, nowMs -  5L * 60_000L,    nowMs));
            case "15Min" -> toObjectList(fetchTicks(symbol, nowMs - 15L * 60_000L,    nowMs));

            case "1H"  -> toObjectList(fetchOhlc(symbol, "1m",  nowMs - MS_PER_HOUR));
            case "1D"  -> toObjectList(fetchOhlc(symbol, "30m", nowMs - MS_PER_DAY));
            case "1W"  -> toObjectList(fetchOhlc(symbol, "2h",  nowMs -  7L * MS_PER_DAY));
            case "1M"  -> toObjectList(fetchOhlc(symbol, "8h",  nowMs - 30L * MS_PER_DAY));
            case "3M"  -> toObjectList(fetchOhlc(symbol, "1d",  nowMs - 90L * MS_PER_DAY));
            case "1Y"  -> toObjectList(fetchOhlc(symbol, "5d",  nowMs - 365L * MS_PER_DAY));
            case "5Y"  -> toObjectList(fetchOhlc(symbol, "1mo", nowMs - 5L * 365 * MS_PER_DAY));
            case "ALL" -> toObjectList(fetchOhlc(symbol, "1mo", 0L));

            default -> {
                log.warn("Unknown range requested: {}", range);
                yield List.of();
            }
        };
    }

    private static List<Object> toObjectList(List<?> items) {
        return items.stream().map(Object.class::cast).toList();
    }

    private List<TickDto> fetchTicks(String symbol, long startMs, long endMs) {
        return liveTickCacheService.getTicksInWindow(symbol, startMs, endMs);
    }

    private List<OhlcDto> fetchOhlc(String symbol, String intervalString, long cutoffMs) {
        return ohlcDataRepository
                .findBySymbolAndIntervalStringAndTimestampGreaterThanEqualOrderByTimestampAsc(
                        symbol, intervalString, cutoffMs)
                .stream()
                .map(o -> new OhlcDto(
                        o.getTimestamp(),
                        o.getOpen(),
                        o.getHigh(),
                        o.getLow(),
                        o.getClose(),
                        o.getVolume()))
                .toList();
    }
}
