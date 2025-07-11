package com.matrix2121.cryptotrade.trades;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.portfolio.AssetDto;
import com.matrix2121.cryptotrade.trades.dao.TradeDao;

@Service
public class TradeService {
    
    @Autowired
    private TradeDao tradeDao;

    @Transactional
    public TradeDto sellCrypto(Long userId, AssetDto assetDto){
        return tradeDao.sellCrypto(userId, assetDto, 12);
    }

    @Transactional
    public TradeDto buyCrypto(Long userId, AssetDto assetDto){
        return tradeDao.buyCrypto(userId, assetDto, 12);
    }
}
