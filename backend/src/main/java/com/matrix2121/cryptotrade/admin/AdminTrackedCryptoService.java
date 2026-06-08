package com.matrix2121.cryptotrade.admin;

import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;
import com.matrix2121.cryptotrade.marketstats.CoinGeckoIdResolver;
import com.matrix2121.cryptotrade.marketstats.CoinGeckoSearchClient;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class AdminTrackedCryptoService {

    private static final Pattern SYMBOL_PATTERN = Pattern.compile("^[A-Z0-9]+/USD$");

    private final TrackedAssetRepository trackedAssetRepository;
    private final TrackedSymbolsService trackedSymbolsService;
    private final CoinGeckoIdResolver coinGeckoIdResolver;
    private final CoinGeckoSearchClient coinGeckoSearchClient;

    public AdminTrackedCryptoService(
            TrackedAssetRepository trackedAssetRepository,
            TrackedSymbolsService trackedSymbolsService,
            CoinGeckoIdResolver coinGeckoIdResolver,
            CoinGeckoSearchClient coinGeckoSearchClient) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.trackedSymbolsService = trackedSymbolsService;
        this.coinGeckoIdResolver = coinGeckoIdResolver;
        this.coinGeckoSearchClient = coinGeckoSearchClient;
    }

    public TrackedAsset addSymbol(String rawSymbol) {
        String symbol = normalizeSymbol(rawSymbol);
        if (!SYMBOL_PATTERN.matcher(symbol).matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Symbol must be in BASE/USD format (e.g. DOT/USD)");
        }
        if (trackedAssetRepository.existsById(symbol)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Symbol already tracked");
        }

        String coingeckoId = resolveCoingeckoId(symbol);
        TrackedAsset asset = trackedAssetRepository.save(
                new TrackedAsset(symbol, null, null, null, null, null, null, null, coingeckoId));
        trackedSymbolsService.refreshCache();
        return asset;
    }

    private String resolveCoingeckoId(String symbol) {
        String fromDefaults = coinGeckoIdResolver.resolveDefault(symbol).orElse(null);
        if (fromDefaults != null) {
            return fromDefaults;
        }

        String base = symbol.split("/")[0];
        String fromSearch = coinGeckoSearchClient.searchCoinId(base).orElse(null);
        if (fromSearch == null) {
            log.warn("Could not resolve CoinGecko id for {}; market stats sync will skip until resolved", symbol);
        }
        return fromSearch;
    }

    public void removeSymbol(String rawSymbol) {
        String symbol = normalizeSymbol(rawSymbol);
        if (!trackedAssetRepository.existsById(symbol)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Symbol not tracked");
        }
        trackedAssetRepository.deleteById(symbol);
        trackedSymbolsService.refreshCache();
    }

    private String normalizeSymbol(String rawSymbol) {
        if (rawSymbol == null || rawSymbol.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol is required");
        }
        String normalized = rawSymbol.trim().replace("-", "/").toUpperCase();
        if (!normalized.contains("/")) {
            normalized = normalized + "/USD";
        }
        return normalized;
    }
}
