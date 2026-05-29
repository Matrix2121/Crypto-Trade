package com.matrix2121.cryptotrade.history;

import java.math.BigDecimal;

public record HistoricalPriceDto(
        Long id,
        String symbol,
        Integer timeframe,
        Long timestamp,
        BigDecimal openPrice,
        BigDecimal highPrice,
        BigDecimal lowPrice,
        BigDecimal closePrice,
        BigDecimal volume) {
}
