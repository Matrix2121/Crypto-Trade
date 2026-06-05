package com.matrix2121.cryptotrade.marketdata;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class TrackedSymbols {

    public static final List<String> SYMBOLS = List.of(
            "BTC/USD", "ETH/USD", "XRP/USD", "USDT/USD", "BNB/USD",
            "SOL/USD", "USDC/USD", "DOGE/USD", "TRX/USD", "ADA/USD",
            "WBTC/USD", "XLM/USD", "SUI/USD", "LINK/USD", "HBAR/USD",
            "BCH/USD", "AVAX/USD", "SHIB/USD", "TON/USD", "LTC/USD");

    private static final Map<String, String> BASE_TO_SYMBOL = buildBaseToSymbolMap();

    private TrackedSymbols() {
    }

    public static Map<String, String> baseToSymbol() {
        return BASE_TO_SYMBOL;
    }

    /**
     * Resolves a path segment (e.g. {@code btc}, {@code BTC-USD}, {@code BTC/USD})
     * to a tracked pair symbol such as {@code BTC/USD}.
     */
    public static Optional<String> resolveFromPath(String pathSymbol) {
        if (pathSymbol == null || pathSymbol.isBlank()) {
            return Optional.empty();
        }
        String normalized = pathSymbol.replace("-", "/").toUpperCase();
        if (normalized.contains("/")) {
            return Optional.of(normalized);
        }
        return Optional.ofNullable(BASE_TO_SYMBOL.get(pathSymbol.toLowerCase()));
    }

    private static Map<String, String> buildBaseToSymbolMap() {
        Map<String, String> map = new HashMap<>();
        for (String symbol : SYMBOLS) {
            String base = symbol.split("/")[0].toLowerCase();
            map.put(base, symbol);
        }
        return Collections.unmodifiableMap(map);
    }
}
