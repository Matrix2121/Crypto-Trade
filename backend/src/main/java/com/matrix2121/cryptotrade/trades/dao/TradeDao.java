package com.matrix2121.cryptotrade.trades.dao;

import java.math.BigDecimal;

import com.matrix2121.cryptotrade.trades.TradeDto;

public interface TradeDao {
    public TradeDto sellCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice);
    public TradeDto buyCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice);
}
