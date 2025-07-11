package com.matrix2121.cryptotrade.trades.dao;

import java.math.BigDecimal;

import com.matrix2121.cryptotrade.portfolio.AssetDto;
import com.matrix2121.cryptotrade.trades.TradeDto;

public interface TradeDao {
    public TradeDto sellCrypto(Long userId, AssetDto assetDto, BigDecimal unitPrice);
    public TradeDto buyCrypto(Long userId, AssetDto assetDto, BigDecimal unitPrice);
}
