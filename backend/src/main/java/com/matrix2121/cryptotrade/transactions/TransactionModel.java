package com.matrix2121.cryptotrade.transactions;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionModel(
        Long id,
        String cryptoCode,
        BigDecimal unitPrice,
        BigDecimal cryptoAmount,
        BigDecimal localCurrencyAmount,
        Boolean isPurchase,
        Instant tradeTimestamp,
        Long userId) {
}
