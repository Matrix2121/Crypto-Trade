package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;

public record PortfolioValuePointDto(String label, BigDecimal totalValue, BigDecimal cashBalance) {}
