package com.matrix2121.cryptotrade.balance;

import java.math.BigDecimal;

public class BalanceMapper {

    public static BalanceDto mapToBalanceDto(BigDecimal balance) {
        return new BalanceDto(balance);
    }
}
