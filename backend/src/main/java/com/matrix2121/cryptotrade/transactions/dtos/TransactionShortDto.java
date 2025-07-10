package com.matrix2121.cryptotrade.transactions.dtos;

import java.math.BigDecimal;

public record TransactionShortDto(
    Long id,
    String cryptoCode,
    BigDecimal cryptoAmount,
    Boolean isPurchase) {
}
