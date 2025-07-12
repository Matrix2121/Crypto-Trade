package com.matrix2121.cryptotrade.context;

import java.math.BigDecimal;
import java.util.HashMap;

import org.springframework.stereotype.Service;

@Service
public class CryptoPricesContext {
    private static HashMap<String, BigDecimal> bidMap = new HashMap<>();
    private static HashMap<String, BigDecimal> askMap = new HashMap<>();

    public static void setPrices(String crypto, BigDecimal bid, BigDecimal ask) {
        bidMap.put(crypto, bid);
        askMap.put(crypto, ask);
    }

    public static BigDecimal getBid(String crypto) {
        return bidMap.get(crypto);
    }

    public static BigDecimal getAsk(String crypto) {
        return askMap.get(crypto);
    }
}
