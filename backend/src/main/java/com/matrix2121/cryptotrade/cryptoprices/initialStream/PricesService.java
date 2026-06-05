package com.matrix2121.cryptotrade.cryptoprices.initialStream;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.model.PriceTick;

@Service
public class PricesService {
    public List<PriceTick> getAllPrices() {
        List<PriceTick> prices = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : CryptoPricesContext.getBidMap().entrySet()) {
            String symbol = entry.getKey();
            BigDecimal bid = entry.getValue();
            BigDecimal ask = CryptoPricesContext.getAskMap().get(symbol);
            if (ask != null) {
                Instant updatedAt = CryptoPricesContext.getLastUpdated(symbol);
                prices.add(new PriceTick(
                        symbol,
                        ask,
                        bid,
                        CryptoPricesContext.getPreviousAsk(symbol),
                        CryptoPricesContext.getPreviousBid(symbol),
                        updatedAt != null ? updatedAt : Instant.EPOCH));
            }
        }
        return prices;
    }
}
