package com.matrix2121.cryptotrade.balance.dao;

import com.matrix2121.cryptotrade.balance.BalanceDto;

public interface BalanceDao {
    public BalanceDto getBalanceByUserId(Long userId);
}
