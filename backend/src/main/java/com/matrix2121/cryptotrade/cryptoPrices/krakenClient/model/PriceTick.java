package com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model;

import java.math.BigDecimal;
import java.time.Instant;

public record PriceTick(
        String symbol,
        BigDecimal ask,
        BigDecimal bid,
        Instant timestamp) {
}
