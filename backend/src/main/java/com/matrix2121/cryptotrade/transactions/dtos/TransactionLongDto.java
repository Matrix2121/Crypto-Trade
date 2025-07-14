package com.matrix2121.cryptotrade.transactions.dtos;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionLongDto(
    Long id,
    String cryptoCode,
    BigDecimal unitPrice,
    BigDecimal cryptoAmount,
    BigDecimal localCurrencyAmount,
    Boolean isPurchase,
    Instant tradeTimestamp) {
}