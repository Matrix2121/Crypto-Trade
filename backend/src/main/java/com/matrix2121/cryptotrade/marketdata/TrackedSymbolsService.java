package com.matrix2121.cryptotrade.marketdata;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketstats.CoinGeckoIdResolver;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

import jakarta.annotation.PostConstruct;

@Service
public class TrackedSymbolsService {

    public static final List<String> DEFAULT_SYMBOLS = List.of(
            "BTC/USD", "ETH/USD", "XRP/USD", "USDT/USD", "BNB/USD",
            "SOL/USD", "USDC/USD", "DOGE/USD", "TRX/USD", "ADA/USD",
            "WBTC/USD", "XLM/USD", "SUI/USD", "LINK/USD", "HBAR/USD",
            "BCH/USD", "AVAX/USD", "SHIB/USD", "TON/USD", "LTC/USD");

    private final TrackedAssetRepository trackedAssetRepository;
    private final CoinGeckoIdResolver coinGeckoIdResolver;

    private volatile List<String> symbols = List.of();
    private volatile Map<String, String> baseToSymbol = Map.of();

    public TrackedSymbolsService(
            TrackedAssetRepository trackedAssetRepository,
            CoinGeckoIdResolver coinGeckoIdResolver) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.coinGeckoIdResolver = coinGeckoIdResolver;
    }

    @PostConstruct
    public void init() {
        seedDefaultsIfEmpty();
        refreshCache();
    }

    public void seedDefaultsIfEmpty() {
        if (trackedAssetRepository.count() > 0) {
            return;
        }
        for (String symbol : DEFAULT_SYMBOLS) {
            String coingeckoId = coinGeckoIdResolver.resolveDefault(symbol).orElse(null);
            trackedAssetRepository.save(
                    new TrackedAsset(symbol, null, null, null, null, null, null, null, coingeckoId));
        }
    }

    public void refreshCache() {
        List<String> loaded = trackedAssetRepository.findAll().stream()
                .map(TrackedAsset::getSymbol)
                .sorted()
                .toList();

        Map<String, String> map = new HashMap<>();
        for (String symbol : loaded) {
            map.put(symbol.split("/")[0].toLowerCase(), symbol);
        }

        this.symbols = List.copyOf(loaded);
        this.baseToSymbol = Collections.unmodifiableMap(map);
    }

    public List<String> getSymbols() {
        return symbols;
    }

    public Map<String, String> baseToSymbol() {
        return baseToSymbol;
    }

    public Optional<String> resolveFromPath(String pathSymbol) {
        if (pathSymbol == null || pathSymbol.isBlank()) {
            return Optional.empty();
        }
        String normalized = pathSymbol.replace("-", "/").toUpperCase();
        if (normalized.contains("/")) {
            return symbols.contains(normalized) ? Optional.of(normalized) : Optional.empty();
        }
        return Optional.ofNullable(baseToSymbol.get(pathSymbol.toLowerCase()));
    }
}
