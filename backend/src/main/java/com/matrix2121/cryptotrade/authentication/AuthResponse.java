package com.matrix2121.cryptotrade.authentication;

import java.math.BigDecimal;

public record AuthResponse(Long id, String jwt, String username, BigDecimal balance, boolean isAdmin) {
}

