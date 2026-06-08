package com.matrix2121.cryptotrade.marketstats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CoinGeckoIdResolverTest {

    private final CoinGeckoIdResolver resolver = new CoinGeckoIdResolver();

    @Test
    void resolveDefault_knownSymbols() {
        assertEquals("bitcoin", resolver.resolveDefault("BTC/USD").orElseThrow());
        assertEquals("ethereum", resolver.resolveDefault("ETH/USD").orElseThrow());
        assertEquals("solana", resolver.resolveDefault("SOL/USD").orElseThrow());
    }

    @Test
    void resolveDefault_unknownSymbolEmpty() {
        assertTrue(resolver.resolveDefault("UNKNOWN/USD").isEmpty());
    }
}
