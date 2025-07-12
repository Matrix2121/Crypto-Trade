package com.matrix2121.cryptotrade.trades;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.trades.dao.TradeDao;
import com.matrix2121.cryptotrade.trades.dtos.*;

@Service
public class TradeService {
    
    @Autowired
    private TradeDao tradeDao;

    @Transactional
    public TradeResponseDto sellCrypto(Long userId, TradeRequestDto tradeRequestDto){
        return tradeDao.sellCrypto(userId, tradeRequestDto.cryptoCode(), tradeRequestDto.cryptoAmount(), CryptoPricesContext.getBid(tradeRequestDto.cryptoCode()));
    }

    @Transactional
    public TradeResponseDto buyCrypto(Long userId, TradeRequestDto tradeRequestDto){
        return tradeDao.buyCrypto(userId, tradeRequestDto.cryptoCode(), tradeRequestDto.cryptoAmount(), CryptoPricesContext.getAsk(tradeRequestDto.cryptoCode()));
    }
}
