package com.matrix2121.cryptotrade.cryptoprices.krakenclient.model;

import java.math.BigDecimal;
import java.time.Instant;

public record PriceTick(
        String symbol,
        BigDecimal ask,
        BigDecimal bid,
        BigDecimal previousAsk,
        BigDecimal previousBid,
        Instant timestamp) {
}
