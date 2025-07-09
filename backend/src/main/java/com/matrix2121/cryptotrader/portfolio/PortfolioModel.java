package com.matrix2121.cryptotrader.portfolio;

import java.math.BigDecimal;

public record PortfolioModel(
	long id,
	String cryptoCode,
	BigDecimal cryptoAmount,
	long userId) {
}
