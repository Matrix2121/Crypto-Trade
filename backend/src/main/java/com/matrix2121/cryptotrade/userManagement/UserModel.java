package com.matrix2121.cryptotrade.userManagement;

import java.math.BigDecimal;

import com.matrix2121.cryptotrade.security.User;

public record UserModel(
		Long id,
		String username,
		String email,
		BigDecimal balance,
		String pictureUrl) implements User {
}
