package com.matrix2121.cryptotrade.marketdata.dto;

import java.math.BigDecimal;

public record OhlcDto(
        Long timestamp,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close) {
}
