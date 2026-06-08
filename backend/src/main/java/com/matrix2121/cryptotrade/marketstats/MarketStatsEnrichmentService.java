package com.matrix2121.cryptotrade.marketstats;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcData;
import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

@Service
public class MarketStatsEnrichmentService {

    private static final long MS_PER_HOUR = 3_600_000L;
    private static final long MS_24H = 24L * MS_PER_HOUR;

    private final OhlcDataRepository ohlcDataRepository;

    public MarketStatsEnrichmentService(OhlcDataRepository ohlcDataRepository) {
        this.ohlcDataRepository = ohlcDataRepository;
    }

    public Double resolveChange24h(String symbol, Double storedChange24h) {
        if (storedChange24h != null) {
            return storedChange24h;
        }
        return computeChange24h(symbol).orElse(null);
    }

    public Optional<Double> computeChange24h(String symbol) {
        BigDecimal current = currentMidPrice(symbol);
        if (current == null) {
            return Optional.empty();
        }

        long targetTimestamp = System.currentTimeMillis() - MS_24H;
        BigDecimal reference = referencePriceAt(symbol, targetTimestamp, "1h");
        if (reference == null) {
            reference = referencePriceAt(symbol, targetTimestamp, "1m");
        }
        if (reference == null) {
            reference = referencePriceAt(symbol, targetTimestamp, "1d");
        }
        if (reference == null || reference.compareTo(BigDecimal.ZERO) == 0) {
            return Optional.empty();
        }

        double change = current.subtract(reference)
                .divide(reference, 8, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
        return Optional.of(change);
    }

    private BigDecimal currentMidPrice(String symbol) {
        BigDecimal bid = CryptoPricesContext.getBidMap().get(symbol);
        BigDecimal ask = CryptoPricesContext.getAskMap().get(symbol);
        if (bid != null && ask != null) {
            return bid.add(ask).divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        }
        return latestClose(symbol, "1m")
                .or(() -> latestClose(symbol, "1h"))
                .orElse(null);
    }

    private BigDecimal referencePriceAt(String symbol, long targetTimestamp, String interval) {
        return ohlcDataRepository
                .findFirstBySymbolAndIntervalStringAndTimestampLessThanEqualOrderByTimestampDesc(
                        symbol, interval, targetTimestamp)
                .map(OhlcData::getClose)
                .orElse(null);
    }

    private Optional<BigDecimal> latestClose(String symbol, String interval) {
        return ohlcDataRepository
                .findFirstBySymbolAndIntervalStringOrderByTimestampDesc(symbol, interval)
                .map(OhlcData::getClose);
    }
}
