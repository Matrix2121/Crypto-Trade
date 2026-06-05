package com.matrix2121.cryptotrade.cryptoprices.initialStream;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.model.PriceTick;
import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;

@Service
public class PricesService {

    private final TrackedSymbolsService trackedSymbolsService;

    public PricesService(TrackedSymbolsService trackedSymbolsService) {
        this.trackedSymbolsService = trackedSymbolsService;
    }

    public List<PriceTick> getAllPrices() {
        List<String> symbols = trackedSymbolsService.getSymbols();
        List<PriceTick> prices = new ArrayList<>(symbols.size());

        for (String symbol : symbols) {
            BigDecimal bid = CryptoPricesContext.getBidMap().get(symbol);
            BigDecimal ask = CryptoPricesContext.getAskMap().get(symbol);
            Instant updatedAt = CryptoPricesContext.getLastUpdated(symbol);

            prices.add(new PriceTick(
                    symbol,
                    ask,
                    bid,
                    CryptoPricesContext.getPreviousAsk(symbol),
                    CryptoPricesContext.getPreviousBid(symbol),
                    updatedAt));
        }

        return prices;
    }
}
