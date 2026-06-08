package com.matrix2121.cryptotrade.marketstats;

import java.util.Optional;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class CoinGeckoSearchClient {

    private static final String SEARCH_URL =
            "https://api.coingecko.com/api/v3/search?query=";

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Resolves a CoinGecko coin id from a base asset symbol (e.g. "DOT" → "polkadot").
     */
    public Optional<String> searchCoinId(String baseSymbol) {
        if (baseSymbol == null || baseSymbol.isBlank()) {
            return Optional.empty();
        }

        String query = baseSymbol.trim().toLowerCase();
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, "CryptoTrade/1.0");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    SEARCH_URL + query,
                    HttpMethod.GET,
                    request,
                    JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) {
                return Optional.empty();
            }

            JsonNode coins = body.path("coins");
            if (!coins.isArray()) {
                return Optional.empty();
            }

            for (JsonNode coin : coins) {
                String symbol = coin.path("symbol").asText("").toLowerCase();
                if (query.equals(symbol)) {
                    String id = coin.path("id").asText(null);
                    if (id != null && !id.isBlank()) {
                        return Optional.of(id);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("CoinGecko search failed for {}: {}", baseSymbol, e.getMessage());
        }

        return Optional.empty();
    }
}
