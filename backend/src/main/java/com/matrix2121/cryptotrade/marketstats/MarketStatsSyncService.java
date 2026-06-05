package com.matrix2121.cryptotrade.marketstats;



import java.math.BigDecimal;

import java.time.Instant;

import java.util.Map;



import org.springframework.boot.context.event.ApplicationReadyEvent;

import org.springframework.context.event.EventListener;

import org.springframework.http.HttpEntity;

import org.springframework.http.HttpHeaders;

import org.springframework.http.HttpMethod;

import org.springframework.http.ResponseEntity;

import org.springframework.scheduling.annotation.Scheduled;

import org.springframework.stereotype.Service;

import org.springframework.web.client.RestTemplate;



import com.fasterxml.jackson.databind.JsonNode;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;

import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;

import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;



import lombok.extern.slf4j.Slf4j;



@Slf4j

@Service

public class MarketStatsSyncService {



    private static final String COINGECKO_MARKETS_URL =

            "https://api.coingecko.com/api/v3/coins/markets"

                    + "?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false";



    private final TrackedAssetRepository trackedAssetRepository;
    private final TrackedSymbolsService trackedSymbolsService;
    private final RestTemplate restTemplate = new RestTemplate();

    public MarketStatsSyncService(
            TrackedAssetRepository trackedAssetRepository,
            TrackedSymbolsService trackedSymbolsService) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.trackedSymbolsService = trackedSymbolsService;
    }



    @EventListener(ApplicationReadyEvent.class)

    public void syncMarketStatsOnStartup() {

        syncMarketStats();

    }



    @Scheduled(fixedRate = 1_800_000, initialDelay = 1_800_000)

    public void syncMarketStats() {

        log.debug("Starting CoinGecko market stats sync");

        try {

            JsonNode[] coins = fetchCoinGeckoMarkets();

            if (coins == null) {

                log.warn("CoinGecko market stats returned null");

                ensureTrackedAssetRowsExist();

                return;

            }



            Map<String, String> baseToSymbol = trackedSymbolsService.baseToSymbol();
            int updated = 0;

            for (JsonNode coin : coins) {

                String coinSymbol = coin.path("symbol").asText("").toLowerCase();

                String trackedSymbol = baseToSymbol.get(coinSymbol);

                if (trackedSymbol == null) {

                    continue;

                }



                TrackedAsset asset = trackedAssetRepository.findById(trackedSymbol)

                        .orElse(new TrackedAsset(trackedSymbol, null, null, null, null, null, null, null));



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

                    updated, baseToSymbol.size());

        } catch (Exception e) {

            log.error("CoinGecko market stats sync failed: {}", e.getMessage(), e);

            ensureTrackedAssetRowsExist();

        }

    }



    private JsonNode[] fetchCoinGeckoMarkets() {

        HttpHeaders headers = new HttpHeaders();

        headers.set(HttpHeaders.USER_AGENT, "CryptoTrade/1.0");

        HttpEntity<Void> request = new HttpEntity<>(headers);



        for (int attempt = 1; attempt <= 3; attempt++) {

            try {

                ResponseEntity<JsonNode[]> response = restTemplate.exchange(

                        COINGECKO_MARKETS_URL,

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



    private void ensureTrackedAssetRowsExist() {

        for (String symbol : trackedSymbolsService.getSymbols()) {

            if (!trackedAssetRepository.existsById(symbol)) {

                trackedAssetRepository.save(

                        new TrackedAsset(symbol, null, null, null, null, null, null, null));

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


