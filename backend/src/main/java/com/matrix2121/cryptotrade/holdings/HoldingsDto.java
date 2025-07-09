package com.matrix2121.cryptotrade.holdings;

import java.math.BigDecimal;

public record HoldingsDto(
    String cryptoCode,
    BigDecimal cryptoAmount) {
}
