package com.matrix2121.cryptotrade.trades.dtos;

import java.math.BigDecimal;

public record TradeRequestDto(
        String cryptoCode,
        BigDecimal cryptoAmount) {
}
