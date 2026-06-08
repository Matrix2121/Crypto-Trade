package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;

public record AllocationSliceDto(String label, BigDecimal valueUsd, BigDecimal percent) {}
