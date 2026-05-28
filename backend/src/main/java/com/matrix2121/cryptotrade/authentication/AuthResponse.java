package com.matrix2121.cryptotrade.authentication;

import java.math.BigDecimal;

public record AuthResponse(String jwt, String username, BigDecimal balance) {
}

