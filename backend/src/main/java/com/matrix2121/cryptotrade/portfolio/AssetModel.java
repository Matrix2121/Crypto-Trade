package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;

public record AssetModel(
		Long id,
		String cryptoCode,
		BigDecimal cryptoAmount,
		Long userId) {
}
