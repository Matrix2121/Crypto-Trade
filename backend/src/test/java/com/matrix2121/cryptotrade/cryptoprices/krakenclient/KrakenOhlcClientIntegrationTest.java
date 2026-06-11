package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;

class KrakenOhlcClientIntegrationTest {

    private final KrakenOhlcClient krakenOhlcClient = new KrakenOhlcClient(new KrakenApiThrottle());

    @Test
    void fetchOhlcSince_fillsMultiDayWindowFromKraken() {
        long twoDaysAgoSec = System.currentTimeMillis() / 1000L - 2L * 24 * 60 * 60;

        List<OhlcDto> candles = krakenOhlcClient.fetchOhlcSince("BTC/USD", 30, twoDaysAgoSec);

        assertFalse(candles.isEmpty());
        assertTrue(
                candles.size() >= 80,
                "Expected ~96 thirty-minute candles over 2 days, got " + candles.size());

        long newest = candles.get(candles.size() - 1).timestamp();
        assertTrue(
                newest >= System.currentTimeMillis() - 3L * 60 * 60 * 1000,
                "Newest candle should be within the last 3 hours");
    }
}
