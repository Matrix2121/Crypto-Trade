package com.matrix2121.cryptotrade.admin;

import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

@Service
public class AdminTrackedCryptoService {

    private static final Pattern SYMBOL_PATTERN = Pattern.compile("^[A-Z0-9]+/USD$");

    private final TrackedAssetRepository trackedAssetRepository;
    private final TrackedSymbolsService trackedSymbolsService;

    public AdminTrackedCryptoService(
            TrackedAssetRepository trackedAssetRepository,
            TrackedSymbolsService trackedSymbolsService) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.trackedSymbolsService = trackedSymbolsService;
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

        TrackedAsset asset = trackedAssetRepository.save(
                new TrackedAsset(symbol, null, null, null, null, null, null, null));
        trackedSymbolsService.refreshCache();
        return asset;
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
