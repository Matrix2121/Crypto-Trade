package com.matrix2121.cryptotrade.context;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.exceptions.CryptoNameException;

@Service
public class CryptoPricesContext {
    private static final HashMap<String, BigDecimal> bidMap = new HashMap<>();
    private static final HashMap<String, BigDecimal> askMap = new HashMap<>();
    private static final HashMap<String, BigDecimal> previousBidMap = new HashMap<>();
    private static final HashMap<String, BigDecimal> previousAskMap = new HashMap<>();
    private static final HashMap<String, Instant> lastUpdatedMap = new HashMap<>();
    private static volatile long lastAnyTickEpochMs = 0L;

    public static void setPrices(String crypto, BigDecimal bid, BigDecimal ask, Instant updatedAt) {
        BigDecimal existingBid = bidMap.get(crypto);
        BigDecimal existingAsk = askMap.get(crypto);
        boolean priceChanged = existingBid == null
                || existingAsk == null
                || existingBid.compareTo(bid) != 0
                || existingAsk.compareTo(ask) != 0;

        if (bidMap.containsKey(crypto)) {
            previousBidMap.put(crypto, existingBid);
            previousAskMap.put(crypto, existingAsk);
        }
        bidMap.put(crypto, bid);
        askMap.put(crypto, ask);

        if (priceChanged) {
            Instant effectiveUpdatedAt = updatedAt != null ? updatedAt : Instant.now();
            lastUpdatedMap.put(crypto, effectiveUpdatedAt);
            lastAnyTickEpochMs = Math.max(lastAnyTickEpochMs, effectiveUpdatedAt.toEpochMilli());
        }
    }

    public static BigDecimal getBid(String crypto) {
        if (!bidMap.containsKey(crypto)) {
            throw new CryptoNameException("This crypto is not available!");
        }
        return bidMap.get(crypto);
    }

    public static BigDecimal getAsk(String crypto) {
        if (!askMap.containsKey(crypto)) {
            throw new CryptoNameException("This crypto is not available!");
        }
        return askMap.get(crypto);
    }

    public static BigDecimal getPreviousBid(String crypto) {
        return previousBidMap.get(crypto);
    }

    public static BigDecimal getPreviousAsk(String crypto) {
        return previousAskMap.get(crypto);
    }

    public static Instant getLastUpdated(String crypto) {
        return lastUpdatedMap.get(crypto);
    }

    public static long getLastAnyTickEpochMs() {
        return lastAnyTickEpochMs;
    }

    public static Map<String, BigDecimal> getBidMap() {
        return bidMap;
    }

    public static Map<String, BigDecimal> getAskMap() {
        return askMap;
    }
}
