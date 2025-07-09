package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;

public record AssetDto(
    String cryptoCode,
    BigDecimal cryptoAmount) {
}
