package com.matrix2121.cryptotrade.marketstats;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.marketdata.TrackedSymbols;
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
    private final RestTemplate restTemplate = new RestTemplate();
    private final Map<String, String> baseToSymbol = TrackedSymbols.baseToSymbol();

    public MarketStatsSyncService(TrackedAssetRepository trackedAssetRepository) {
        this.trackedAssetRepository = trackedAssetRepository;
    }

    @Scheduled(fixedRate = 1_800_000)
    public void syncMarketStats() {
        log.debug("Starting CoinGecko market stats sync");
        try {
            JsonNode[] coins = restTemplate.getForObject(COINGECKO_MARKETS_URL, JsonNode[].class);
            if (coins == null) {
                log.warn("CoinGecko market stats returned null");
                return;
            }

            int updated = 0;
            for (JsonNode coin : coins) {
                String coinSymbol = coin.path("symbol").asText("").toLowerCase();
                String trackedSymbol = baseToSymbol.get(coinSymbol);
                if (trackedSymbol == null) {
                    continue;
                }

                TrackedAsset asset = trackedAssetRepository.findById(trackedSymbol)
                        .orElse(new TrackedAsset(trackedSymbol, null, null, null, null, null));

                asset.setMarketRank(nullableInt(coin, "market_cap_rank"));
                asset.setMarketCap(nullableLong(coin, "market_cap"));
                asset.setCirculatingSupply(nullableLong(coin, "circulating_supply"));

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

            log.info("CoinGecko sync complete: updated {}/{} tracked symbols",
                    updated, baseToSymbol.size());
        } catch (Exception e) {
            log.error("CoinGecko market stats sync failed: {}", e.getMessage(), e);
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
