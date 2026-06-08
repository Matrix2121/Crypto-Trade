package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;
import java.util.List;

public record AssetPnlDto(
        String cryptoCode,
        BigDecimal quantityHeld,
        BigDecimal costBasisTotal,
        BigDecimal realizedPnl,
        BigDecimal currentPrice,
        BigDecimal marketValue,
        BigDecimal averageEntryPrice,
        BigDecimal unrealizedPnl) {

    public AssetPnlDto(
            String cryptoCode,
            BigDecimal quantityHeld,
            BigDecimal costBasisTotal,
            BigDecimal realizedPnl,
            BigDecimal currentPrice,
            BigDecimal marketValue) {
        this(cryptoCode, quantityHeld, costBasisTotal, realizedPnl, currentPrice, marketValue,
                BigDecimal.ZERO, BigDecimal.ZERO);
    }
}
