package com.matrix2121.cryptotrade.marketdata.dto;

import java.math.BigDecimal;

public record TickDto(Long timestamp, BigDecimal price, BigDecimal bid, BigDecimal ask) {

    /** Convenience constructor for callers without bid/ask (e.g. Kraken trade history). */
    public static TickDto ofPrice(Long timestamp, BigDecimal price) {
        return new TickDto(timestamp, price, null, null);
    }
}
