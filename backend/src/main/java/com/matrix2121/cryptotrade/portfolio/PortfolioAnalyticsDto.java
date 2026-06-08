package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;
import java.util.List;

public record PortfolioAnalyticsDto(
        BigDecimal totalPortfolioValue,
        BigDecimal cashBalance,
        BigDecimal cryptoValue,
        BigDecimal unrealizedPnl,
        BigDecimal realizedPnl,
        List<AssetPnlDto> holdings,
        List<AllocationSliceDto> allocation,
        List<PortfolioValuePointDto> valueHistory) {}
