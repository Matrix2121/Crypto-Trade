package com.matrix2121.cryptotrade.marketstats;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MarketStatsSyncService {

    private static final String COINGECKO_MARKETS_BASE =
            "https://api.coingecko.com/api/v3/coins/markets";
    private static final int BATCH_SIZE = 100;

    private final TrackedAssetRepository trackedAssetRepository;
    private final TrackedSymbolsService trackedSymbolsService;
    private final CoinGeckoIdResolver coinGeckoIdResolver;
    private final RestTemplate restTemplate = new RestTemplate();
    private final Set<String> warnedMissingIds = java.util.concurrent.ConcurrentHashMap.newKeySet();

    public MarketStatsSyncService(
            TrackedAssetRepository trackedAssetRepository,
            TrackedSymbolsService trackedSymbolsService,
            CoinGeckoIdResolver coinGeckoIdResolver) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.trackedSymbolsService = trackedSymbolsService;
        this.coinGeckoIdResolver = coinGeckoIdResolver;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void syncMarketStatsOnStartup() {
        backfillMissingCoingeckoIds();
        syncMarketStats();
    }

    @Scheduled(fixedRate = 1_800_000, initialDelay = 1_800_000)
    public void syncMarketStats() {
        log.debug("Starting CoinGecko market stats sync");

        try {
            Map<String, String> symbolToId = loadTrackedCoinIds();
            if (symbolToId.isEmpty()) {
                log.warn("No tracked assets with CoinGecko ids; skipping market stats sync");
                ensureTrackedAssetRowsExist();
                return;
            }

            List<String> coinIds = symbolToId.values().stream().distinct().toList();
            Map<String, JsonNode> coinById = fetchCoinGeckoMarketsByIds(coinIds);
            Map<String, String> idToSymbol = invertMap(symbolToId);

            int updated = 0;
            for (Map.Entry<String, JsonNode> entry : coinById.entrySet()) {
                String trackedSymbol = idToSymbol.get(entry.getKey());
                if (trackedSymbol == null) {
                    continue;
                }

                JsonNode coin = entry.getValue();
                TrackedAsset asset = trackedAssetRepository.findById(trackedSymbol)
                        .orElse(new TrackedAsset(trackedSymbol, null, null, null, null, null, null, null, entry.getKey()));

                asset.setCoingeckoId(entry.getKey());
                asset.setMarketRank(nullableInt(coin, "market_cap_rank"));
                asset.setMarketCap(nullableLong(coin, "market_cap"));
                asset.setCirculatingSupply(nullableLong(coin, "circulating_supply"));
                asset.setChange24h(nullableDouble(coin, "price_change_percentage_24h"));
                asset.setVolume24h(nullableLong(coin, "total_volume"));

                BigDecimal geckoAth = nullableBigDecimal(coin, "ath");
                if (geckoAth != null
                        && (asset.getAllTimeHigh() == null
                                || geckoAth.compareTo(asset.getAllTimeHigh()) > 0)) {
                    asset.setAllTimeHigh(geckoAth);
                    asset.setAthTimestamp(parseAthTimestamp(coin.path("ath_date").asText(null)));
                }

                trackedAssetRepository.save(asset);
                updated++;
            }

            ensureTrackedAssetRowsExist();
            log.info("CoinGecko sync complete: updated {}/{} tracked symbols",
                    updated, symbolToId.size());
        } catch (Exception e) {
            log.error("CoinGecko market stats sync failed: {}", e.getMessage(), e);
            ensureTrackedAssetRowsExist();
        }
    }

    private Map<String, String> loadTrackedCoinIds() {
        Map<String, String> symbolToId = new HashMap<>();
        for (TrackedAsset asset : trackedAssetRepository.findAll()) {
            String id = asset.getCoingeckoId();
            if (id == null || id.isBlank()) {
                id = coinGeckoIdResolver.resolveDefault(asset.getSymbol()).orElse(null);
                if (id != null) {
                    asset.setCoingeckoId(id);
                    trackedAssetRepository.save(asset);
                }
            }
            if (id != null && !id.isBlank()) {
                symbolToId.put(asset.getSymbol(), id);
            } else if (warnedMissingIds.add(asset.getSymbol())) {
                log.warn("No CoinGecko id for {}; market stats sync will skip this symbol", asset.getSymbol());
            }
        }
        return symbolToId;
    }

    private void backfillMissingCoingeckoIds() {
        for (TrackedAsset asset : trackedAssetRepository.findAll()) {
            if (asset.getCoingeckoId() != null && !asset.getCoingeckoId().isBlank()) {
                continue;
            }
            coinGeckoIdResolver.resolveDefault(asset.getSymbol()).ifPresent(id -> {
                asset.setCoingeckoId(id);
                trackedAssetRepository.save(asset);
            });
        }
    }

    private Map<String, JsonNode> fetchCoinGeckoMarketsByIds(List<String> coinIds) {
        Map<String, JsonNode> byId = new HashMap<>();
        for (int i = 0; i < coinIds.size(); i += BATCH_SIZE) {
            List<String> batch = coinIds.subList(i, Math.min(i + BATCH_SIZE, coinIds.size()));
            JsonNode[] coins = fetchCoinGeckoMarketsBatch(batch);
            if (coins == null) {
                continue;
            }
            for (JsonNode coin : coins) {
                String id = coin.path("id").asText(null);
                if (id != null) {
                    byId.put(id, coin);
                }
            }
        }
        return byId;
    }

    private JsonNode[] fetchCoinGeckoMarketsBatch(List<String> coinIds) {
        String idsParam = coinIds.stream().collect(Collectors.joining(","));
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, "CryptoTrade/1.0");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        String url = UriComponentsBuilder.fromUriString(COINGECKO_MARKETS_BASE)
                .queryParam("vs_currency", "usd")
                .queryParam("ids", idsParam)
                .queryParam("sparkline", false)
                .build()
                .toUriString();

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                ResponseEntity<JsonNode[]> response = restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        request,
                        JsonNode[].class);
                return response.getBody();
            } catch (Exception e) {
                log.warn("CoinGecko fetch attempt {} failed: {}", attempt, e.getMessage());
                if (attempt < 3) {
                    try {
                        Thread.sleep(1_000L * attempt);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private static Map<String, String> invertMap(Map<String, String> symbolToId) {
        Map<String, String> idToSymbol = new HashMap<>();
        for (Map.Entry<String, String> entry : symbolToId.entrySet()) {
            idToSymbol.put(entry.getValue(), entry.getKey());
        }
        return idToSymbol;
    }

    private void ensureTrackedAssetRowsExist() {
        for (String symbol : trackedSymbolsService.getSymbols()) {
            if (!trackedAssetRepository.existsById(symbol)) {
                String coingeckoId = coinGeckoIdResolver.resolveDefault(symbol).orElse(null);
                trackedAssetRepository.save(
                        new TrackedAsset(symbol, null, null, null, null, null, null, null, coingeckoId));
            }
        }
    }

    private static Integer nullableInt(JsonNode node, String field) {
        JsonNode f = node.path(field);
        return (f.isNull() || f.isMissingNode()) ? null : f.intValue();
    }

    private static Long nullableLong(JsonNode node, String field) {
        JsonNode f = node.path(field);
        return (f.isNull() || f.isMissingNode()) ? null : Math.round(f.doubleValue());
    }

    private static Double nullableDouble(JsonNode node, String field) {
        JsonNode f = node.path(field);
        return (f.isNull() || f.isMissingNode()) ? null : f.doubleValue();
    }

    private static BigDecimal nullableBigDecimal(JsonNode node, String field) {
        JsonNode f = node.path(field);
        if (f.isNull() || f.isMissingNode()) {
            return null;
        }
        try {
            return new BigDecimal(f.asText());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Long parseAthTimestamp(String isoDate) {
        if (isoDate == null || isoDate.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(isoDate).toEpochMilli();
        } catch (Exception e) {
            return null;
        }
    }
}
