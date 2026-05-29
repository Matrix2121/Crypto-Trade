package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import java.net.URI;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;

@Component
public class KrakenOhlcClient {

    private static final String OHLC_URL = "https://api.kraken.com/0/public/OHLC";

    private final RestTemplate restTemplate;

    public KrakenOhlcClient() {
        this.restTemplate = new RestTemplate();
    }

    public JsonNode fetchOhlc(String krakenPair, int interval) {
        URI uri = UriComponentsBuilder.fromUriString(OHLC_URL)
                .queryParam("pair", krakenPair)
                .queryParam("interval", interval)
                .build()
                .toUri();

        try {
            JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
            if (body == null) {
                throw new KrakenApiException("Empty response from Kraken OHLC API");
            }
            validateKrakenResponse(body);
            return body;
        } catch (KrakenApiException e) {
            throw e;
        } catch (RestClientException e) {
            throw new KrakenApiException("Failed to fetch OHLC data from Kraken", e);
        }
    }

    private void validateKrakenResponse(JsonNode body) {
        JsonNode errors = body.get("error");
        if (errors != null && errors.isArray() && !errors.isEmpty()) {
            throw new KrakenApiException("Kraken API error: " + errors);
        }
    }
}
