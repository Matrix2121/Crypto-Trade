package com.matrix2121.cryptotrade.history;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.KrakenOhlcClient;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;

@Service
public class HistoricalPriceService {

    private final HistoricalPriceRepository repository;
    private final KrakenOhlcClient krakenOhlcClient;

    @Autowired
    public HistoricalPriceService(
            HistoricalPriceRepository repository,
            KrakenOhlcClient krakenOhlcClient) {
        this.repository = repository;
        this.krakenOhlcClient = krakenOhlcClient;
    }

    public List<HistoricalPriceDto> getChartData(String symbol, int intervalMinutes) {
        List<HistoricalPrice> stored = repository.findBySymbolAndTimeframeOrderByTimestampAsc(
                symbol, intervalMinutes);

        if (needsFreshData(stored, intervalMinutes)) {
            fetchAndPersist(symbol, intervalMinutes);
        }

        return repository.findBySymbolAndTimeframeOrderByTimestampAsc(symbol, intervalMinutes)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private boolean needsFreshData(List<HistoricalPrice> stored, int intervalMinutes) {
        if (stored.isEmpty()) {
            return true;
        }
        long nowSeconds = System.currentTimeMillis() / 1000;
        long freshnessThreshold = nowSeconds - (intervalMinutes * 60L);
        long latestTimestamp = stored.get(stored.size() - 1).getTimestamp();
        return latestTimestamp < freshnessThreshold;
    }

    private void fetchAndPersist(String symbol, int intervalMinutes) {
        String krakenPair = toKrakenPair(symbol);
        JsonNode response = krakenOhlcClient.fetchOhlc(krakenPair, intervalMinutes);

        JsonNode result = response.get("result");
        if (result == null || result.isNull()) {
            throw new KrakenApiException("Kraken OHLC response missing result");
        }

        JsonNode candles = result.get(krakenPair);
        if (candles == null || !candles.isArray()) {
            candles = findCandleArray(result);
        }

        List<HistoricalPrice> entities = new ArrayList<>();
        for (JsonNode candle : candles) {
            entities.add(parseCandle(symbol, intervalMinutes, candle));
        }

        for (HistoricalPrice entity : entities) {
            try {
                repository.save(entity);
            } catch (DataIntegrityViolationException ignored) {
                // Candle already stored for this symbol, timeframe, and timestamp
            }
        }
    }

    private JsonNode findCandleArray(JsonNode result) {
        Iterator<String> fieldNames = result.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            if ("last".equals(field)) {
                continue;
            }
            JsonNode node = result.get(field);
            if (node.isArray()) {
                return node;
            }
        }
        throw new KrakenApiException("No OHLC candle data in Kraken response");
    }

    private HistoricalPrice parseCandle(String symbol, int intervalMinutes, JsonNode candle) {
        return new HistoricalPrice(
                symbol,
                intervalMinutes,
                candle.get(0).asLong(),
                new BigDecimal(candle.get(1).asText()),
                new BigDecimal(candle.get(2).asText()),
                new BigDecimal(candle.get(3).asText()),
                new BigDecimal(candle.get(4).asText()),
                new BigDecimal(candle.get(6).asText()));
    }

    private String toKrakenPair(String symbol) {
        String[] parts = symbol.split("/");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid symbol format, expected BASE/QUOTE: " + symbol);
        }
        String base = "BTC".equals(parts[0]) ? "XBT" : parts[0];
        return base + parts[1];
    }

    private HistoricalPriceDto toDto(HistoricalPrice entity) {
        return new HistoricalPriceDto(
                entity.getId(),
                entity.getSymbol(),
                entity.getTimeframe(),
                entity.getTimestamp(),
                entity.getOpenPrice(),
                entity.getHighPrice(),
                entity.getLowPrice(),
                entity.getClosePrice(),
                entity.getVolume());
    }
}
