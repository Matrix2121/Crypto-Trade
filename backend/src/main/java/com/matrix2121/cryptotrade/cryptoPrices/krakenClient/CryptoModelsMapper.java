package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import java.math.BigDecimal;
import java.time.Instant;

import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.PriceTick;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.TickerFrame;

public class CryptoModelsMapper {
    public static PriceTick mapTickerFrameToPriceTick(TickerFrame tickerFrame) {
        return new PriceTick(tickerFrame.symbol(),
                new BigDecimal(tickerFrame.ask()),
                new BigDecimal(tickerFrame.bid()),
                Instant.now());
    }
}
