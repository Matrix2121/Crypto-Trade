package com.matrix2121.cryptotrade.trades;

import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.trades.dao.TradeDao;
import com.matrix2121.cryptotrade.trades.dtos.TradeRequestDto;
import com.matrix2121.cryptotrade.trades.dtos.TradeResponseDto;

@Service
public class TradeService {
    
    @Autowired
    private TradeDao tradeDao;

    @Transactional
    public TradeResponseDto sellCrypto(Long userId, TradeRequestDto tradeRequestDto) {
        BigDecimal unitPrice = CryptoPricesContext.getBid(tradeRequestDto.cryptoCode());
        BigDecimal cryptoAmount = TradeAmountResolver.resolveCryptoAmount(
                tradeRequestDto.cryptoAmount(),
                tradeRequestDto.fiatAmount(),
                unitPrice);
        TradeResponseDto response = tradeDao.sellCrypto(
                userId,
                tradeRequestDto.cryptoCode(),
                cryptoAmount,
                unitPrice);
        return normalizeResponse(response, cryptoAmount, unitPrice);
    }

    @Transactional
    public TradeResponseDto buyCrypto(Long userId, TradeRequestDto tradeRequestDto) {
        BigDecimal unitPrice = CryptoPricesContext.getAsk(tradeRequestDto.cryptoCode());
        BigDecimal cryptoAmount = TradeAmountResolver.resolveCryptoAmount(
                tradeRequestDto.cryptoAmount(),
                tradeRequestDto.fiatAmount(),
                unitPrice);
        TradeResponseDto response = tradeDao.buyCrypto(
                userId,
                tradeRequestDto.cryptoCode(),
                cryptoAmount,
                unitPrice);
        return normalizeResponse(response, cryptoAmount, unitPrice);
    }

    private TradeResponseDto normalizeResponse(
            TradeResponseDto response,
            BigDecimal cryptoAmount,
            BigDecimal unitPrice) {
        BigDecimal fiatTotal = TradeAmountResolver.resolveFiatTotal(cryptoAmount, unitPrice);

        return new TradeResponseDto(
                response.cryptoCode(),
                cryptoAmount,
                unitPrice,
                response.oldCryptoBalance(),
                response.newCryptoBalance(),
                fiatTotal,
                response.timestamp());
    }
}
