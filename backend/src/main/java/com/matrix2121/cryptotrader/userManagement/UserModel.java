package com.matrix2121.cryptotrader.userManagement;

import java.math.BigDecimal;

public record UserModel(
	Long id,
	String username,
	BigDecimal balance) {
}
