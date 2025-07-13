package com.matrix2121.cryptotrade.context;

import java.math.BigDecimal;
import java.util.HashMap;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.exceptions.CryptoNameException;

@Service
public class CryptoPricesContext {
    private static HashMap<String, BigDecimal> bidMap = new HashMap<>();
    private static HashMap<String, BigDecimal> askMap = new HashMap<>();

    public static void setPrices(String crypto, BigDecimal bid, BigDecimal ask) {
        bidMap.put(crypto, bid);
        askMap.put(crypto, ask);
    }

    public static BigDecimal getBid(String crypto) {
        if (!bidMap.containsKey(crypto)) {
            throw new CryptoNameException("This crypto is not avaliable!");
        }
        return bidMap.get(crypto);
    }

    public static BigDecimal getAsk(String crypto) {
        if (!askMap.containsKey(crypto)) {
            throw new CryptoNameException("This crypto is not avaliable!");
        }
        return askMap.get(crypto);
    }
}
