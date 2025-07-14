package com.matrix2121.cryptotrade.trades.dao;

import java.math.BigDecimal;

import com.matrix2121.cryptotrade.trades.dtos.TradeResponseDto;

public interface TradeDao {
    public TradeResponseDto sellCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice);
    public TradeResponseDto buyCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice);
}
