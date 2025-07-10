package com.matrix2121.cryptotrade.userManagement.dtos;

import java.math.BigDecimal;

public record UserDto(
    Long id,
    String username,
    BigDecimal balance) {
}
