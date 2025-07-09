package com.matrix2121.cryptotrader.transactions;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionsModel(
    long id,
    String cryptoCode,
    BigDecimal unitPrice,
    BigDecimal cryptoAmount,
    BigDecimal localCurrencyAmount,
    Boolean isPurchase,
    Instant tradeTimestamp,
    long userId) {
}
