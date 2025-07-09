package com.matrix2121.cryptotrade.holdings;

import java.math.BigDecimal;

public record HoldingsModel(
	Long id,
	String cryptoCode,
	BigDecimal cryptoAmount,
	long userId) {
}
