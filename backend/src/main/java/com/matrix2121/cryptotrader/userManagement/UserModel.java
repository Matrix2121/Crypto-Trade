package com.matrix2121.cryptotrader.userManagement;

import java.math.BigDecimal;

public record UserModel(
	long id,
	String username,
	BigDecimal balance) {
}
