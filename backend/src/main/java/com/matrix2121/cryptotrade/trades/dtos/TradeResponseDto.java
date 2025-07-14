package com.matrix2121.cryptotrade.trades.dtos;

import java.math.BigDecimal;
import java.time.Instant;

public record TradeResponseDto(
        String cryptoCode,
        BigDecimal cryptoAmount,
        BigDecimal unitPrice,
        BigDecimal oldCryptoBalance,
        BigDecimal newCryptoBalance,
        BigDecimal fiatChange,
        Instant timestamp) {
}
