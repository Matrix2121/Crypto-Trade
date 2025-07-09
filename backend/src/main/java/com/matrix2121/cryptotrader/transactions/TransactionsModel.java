package com.matrix2121.cryptotrader.transactions;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionsModel(
    Long id,
    String cryptoCode,
    BigDecimal unitPrice,
    BigDecimal cryptoAmount,
    BigDecimal localCurrencyAmount,
    Boolean isPurchase,
    Instant tradeTimestamp,
    Long userId) {
}
