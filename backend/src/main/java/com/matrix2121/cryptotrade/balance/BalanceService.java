package com.matrix2121.cryptotrade.balance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.balance.dao.BalanceDao;


@Service
public class BalanceService {

    @Autowired
    private BalanceDao balanceDao;

    public BalanceDto getBalanceByUserId(Long userId) {
        return balanceDao.getBalanceByUserId(userId);
    }

}
