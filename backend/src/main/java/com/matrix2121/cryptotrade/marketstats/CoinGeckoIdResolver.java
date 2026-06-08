package com.matrix2121.cryptotrade.marketstats;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * Maps tracked trading symbols to CoinGecko coin IDs for targeted market-stats sync.
 */
@Component
public class CoinGeckoIdResolver {

    private static final Map<String, String> DEFAULT_IDS = Map.ofEntries(
            Map.entry("BTC/USD", "bitcoin"),
            Map.entry("ETH/USD", "ethereum"),
            Map.entry("XRP/USD", "ripple"),
            Map.entry("USDT/USD", "tether"),
            Map.entry("BNB/USD", "binancecoin"),
            Map.entry("SOL/USD", "solana"),
            Map.entry("USDC/USD", "usd-coin"),
            Map.entry("DOGE/USD", "dogecoin"),
            Map.entry("TRX/USD", "tron"),
            Map.entry("ADA/USD", "cardano"),
            Map.entry("WBTC/USD", "wrapped-bitcoin"),
            Map.entry("XLM/USD", "stellar"),
            Map.entry("SUI/USD", "sui"),
            Map.entry("LINK/USD", "chainlink"),
            Map.entry("HBAR/USD", "hedera-hashgraph"),
            Map.entry("BCH/USD", "bitcoin-cash"),
            Map.entry("AVAX/USD", "avalanche-2"),
            Map.entry("SHIB/USD", "shiba-inu"),
            Map.entry("TON/USD", "the-open-network"),
            Map.entry("LTC/USD", "litecoin"));

    public Optional<String> resolveDefault(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(DEFAULT_IDS.get(symbol.toUpperCase()));
    }

    public Map<String, String> defaultIdMap() {
        return Collections.unmodifiableMap(DEFAULT_IDS);
    }

    public Map<String, String> symbolToIdMap(Iterable<String> symbols) {
        Map<String, String> map = new HashMap<>();
        for (String symbol : symbols) {
            resolveDefault(symbol).ifPresent(id -> map.put(symbol, id));
        }
        return map;
    }
}
