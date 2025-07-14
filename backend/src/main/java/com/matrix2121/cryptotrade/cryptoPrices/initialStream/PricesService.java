package com.matrix2121.cryptotrade.cryptoPrices.initialStream;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.PriceTick;

@Service
public class PricesService {
    public List<PriceTick> getAllPrices(){
        List<PriceTick> prices = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : CryptoPricesContext.getBidMap().entrySet()) {
            String symbol = entry.getKey();
            BigDecimal bid = entry.getValue();
            BigDecimal ask = CryptoPricesContext.getAskMap().get(symbol);
            if (ask != null) {
                prices.add(new PriceTick(symbol, bid, ask, Instant.now()));
            }
        }
        return prices;
    }
}
