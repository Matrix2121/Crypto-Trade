package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;

@Component
public class KrakenTradesClient {

    private static final String TRADES_URL = "https://api.kraken.com/0/public/Trades";

    private final RestTemplate restTemplate;
    private final KrakenApiThrottle throttle;

    public KrakenTradesClient(KrakenApiThrottle throttle) {
        this.restTemplate = new RestTemplate();
        this.throttle = throttle;
    }

    /**
     * Fetches the most recent trades (up to Kraken's default page of ~1000) with no
     * time filter — used for seeding the TickData table during a full sync.
     */
    public List<TickDto> fetchLastTrades(String symbol) {
        String krakenPair = KrakenPairMapper.toKrakenPair(symbol);
        URI uri = UriComponentsBuilder.fromUriString(TRADES_URL)
                .queryParam("pair", krakenPair)
                .build()
                .toUri();
        throttle.awaitSlot();
        JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
        if (body == null) {
            throw new KrakenApiException("Empty response from Kraken Trades API");
        }
        validateKrakenResponse(body);
        return parseTrades(body, krakenPair, 0L);
    }

    public List<TickDto> fetchRecentTrades(String symbol, int minutes) {
        String krakenPair = KrakenPairMapper.toKrakenPair(symbol);
        URI uri = UriComponentsBuilder.fromUriString(TRADES_URL)
                .queryParam("pair", krakenPair)
                .build()
                .toUri();

        throttle.awaitSlot();
        JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
        if (body == null) {
            throw new KrakenApiException("Empty response from Kraken Trades API");
        }
        validateKrakenResponse(body);
        long cutoffMs = System.currentTimeMillis() - (minutes * 60L * 1000L);
        return parseTrades(body, krakenPair, cutoffMs);
    }

    private List<TickDto> parseTrades(JsonNode body, String krakenPair, long cutoffMs) {
        JsonNode result = body.get("result");
        if (result == null || result.isNull()) {
            throw new KrakenApiException("Kraken Trades response missing result");
        }

        JsonNode trades = result.get(krakenPair);
        if (trades == null || !trades.isArray()) {
            trades = findTradesArray(result);
        }

        List<TickDto> ticks = new ArrayList<>();
        for (JsonNode trade : trades) {
            TickDto tick = parseTrade(trade);
            if (tick.timestamp() >= cutoffMs) {
                ticks.add(tick);
            }
        }

        ticks.sort(Comparator.comparing(TickDto::timestamp));
        return ticks;
    }

    private JsonNode findTradesArray(JsonNode result) {
        Iterator<String> fieldNames = result.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            if ("last".equals(field)) {
                continue;
            }
            JsonNode node = result.get(field);
            if (node != null && node.isArray()) {
                return node;
            }
        }
        throw new KrakenApiException("No trade data in Kraken response");
    }

    private TickDto parseTrade(JsonNode trade) {
        BigDecimal price = new BigDecimal(trade.get(0).asText());
        double timestampSeconds = trade.get(2).asDouble();
        long timestampMs = (long) (timestampSeconds * 1000);
        return TickDto.ofPrice(timestampMs, price);
    }

    private void validateKrakenResponse(JsonNode body) {
        JsonNode errors = body.get("error");
        if (errors != null && errors.isArray() && !errors.isEmpty()) {
            throw new KrakenApiException("Kraken API error: " + errors);
        }
    }
}
