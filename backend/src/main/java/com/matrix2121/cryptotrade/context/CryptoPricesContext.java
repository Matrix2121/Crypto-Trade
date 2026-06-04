package com.matrix2121.cryptotrade.context;

import java.math.BigDecimal;
import java.util.HashMap;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.exceptions.CryptoNameException;

@Service
public class CryptoPricesContext {
    private static HashMap<String, BigDecimal> bidMap = new HashMap<>();
    private static HashMap<String, BigDecimal> askMap = new HashMap<>();
    private static HashMap<String, BigDecimal> previousBidMap = new HashMap<>();
    private static HashMap<String, BigDecimal> previousAskMap = new HashMap<>();

    public static void setPrices(String crypto, BigDecimal bid, BigDecimal ask) {
        if (bidMap.containsKey(crypto)) {
            previousBidMap.put(crypto, bidMap.get(crypto));
            previousAskMap.put(crypto, askMap.get(crypto));
        }
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

    public static BigDecimal getPreviousBid(String crypto) {
        return previousBidMap.get(crypto);
    }

    public static BigDecimal getPreviousAsk(String crypto) {
        return previousAskMap.get(crypto);
    }

    public static HashMap<String, BigDecimal> getBidMap() {
        return bidMap;
    }

    public static HashMap<String, BigDecimal> getAskMap() {
        return askMap;
    }
}
