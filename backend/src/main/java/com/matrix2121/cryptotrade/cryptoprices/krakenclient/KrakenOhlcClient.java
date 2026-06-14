package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;
import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class KrakenOhlcClient {

    private static final String OHLC_URL = "https://api.kraken.com/0/public/OHLC";
    private static final String KRAKEN_ERROR_FIELD = "error";
    private static final int KRAKEN_PAGE_SIZE = 720;
    private static final int MAX_PAGINATION_PAGES = 200;
    private static final int MAX_RATE_LIMIT_RETRIES = 6;

    private final RestTemplate restTemplate;
    private final KrakenApiThrottle throttle;

    @Autowired
    public KrakenOhlcClient(KrakenApiThrottle throttle) {
        this(throttle, new RestTemplate());
    }

    /** Package-private for unit tests. */
    KrakenOhlcClient(KrakenApiThrottle throttle, RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.throttle = throttle;
    }

    public List<OhlcDto> fetchOhlc(String symbol, int interval) {
        return fetchOhlc(symbol, interval, null);
    }

    /**
     * @param sinceMs optional epoch milliseconds; when set, Kraken receives
     *                {@code since} in seconds
     *                and paginated {@link #fetchOhlcSince} is used so gaps larger
     *                than 720 candles fill correctly
     */
    public List<OhlcDto> fetchOhlc(String symbol, int interval, Long sinceMs) {
        if (sinceMs != null) {
            return fetchOhlcSince(symbol, interval, sinceMs / 1000L);
        }

        String krakenPair = KrakenPairMapper.toKrakenPair(symbol);
        URI uri = UriComponentsBuilder.fromUriString(OHLC_URL)
                .queryParam("pair", krakenPair)
                .queryParam("interval", interval)
                .build()
                .toUri();

        JsonNode body = getKrakenJson(uri);
        return parseOhlcPage(body, krakenPair).candles();
    }

    /**
     * Fetches OHLC from sinceSeconds through now using Kraken's {@code since}
     * parameter and the {@code last} cursor returned in each response page.
     */
    public List<OhlcDto> fetchOhlcSince(String symbol, int interval, long sinceSeconds) {
        String krakenPair = KrakenPairMapper.toKrakenPair(symbol);
        TreeMap<Long, OhlcDto> byTimestamp = new TreeMap<>();
        long since = sinceSeconds;
        int pages = 0;

        while (pages < MAX_PAGINATION_PAGES) {
            OhlcPage page = fetchOhlcPage(krakenPair, interval, since);
            if (page.candles().isEmpty()) {
                break;
            }

            for (OhlcDto candle : page.candles()) {
                if (candle.timestamp() / 1000L >= sinceSeconds) {
                    byTimestamp.put(candle.timestamp(), candle);
                }
            }

            pages++;

            if (page.candles().size() < KRAKEN_PAGE_SIZE) {
                break;
            }

            Long nextSince = page.lastId();
            if (nextSince == null || nextSince <= since) {
                break;
            }
            since = nextSince;
        }

        if (pages >= MAX_PAGINATION_PAGES) {
            log.warn(
                    "Kraken OHLC pagination hit max pages ({}) for pair {} interval {}",
                    MAX_PAGINATION_PAGES, krakenPair, interval);
        }

        return new ArrayList<>(byTimestamp.values());
    }

    private OhlcPage fetchOhlcPage(String krakenPair, int interval, long sinceSeconds) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(OHLC_URL)
                .queryParam("pair", krakenPair)
                .queryParam("interval", interval);
        if (sinceSeconds > 0) {
            builder.queryParam("since", sinceSeconds);
        }
        URI uri = builder.build().toUri();
        JsonNode body = getKrakenJson(uri);
        return parseOhlcPage(body, krakenPair);
    }

    private JsonNode getKrakenJson(URI uri) {
        KrakenApiException lastError = null;
        for (int attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
            try {
                throttle.awaitSlot();
                JsonNode body = restTemplate.getForObject(uri, JsonNode.class);
                if (body == null) {
                    throw new KrakenApiException("Empty response from Kraken OHLC API");
                }
                if (isRateLimited(body)) {
                    lastError = new KrakenApiException("Kraken API error: " + body.get(KRAKEN_ERROR_FIELD));
                    log.warn("Kraken OHLC rate limited (attempt {}/{}), backing off",
                            attempt, MAX_RATE_LIMIT_RETRIES);
                    throttle.awaitRateLimitBackoff(attempt);
                    continue;
                }
                validateKrakenResponse(body);
                return body;
            } catch (KrakenApiException e) {
                throw e;
            } catch (RestClientException e) {
                throw new KrakenApiException("Failed to fetch OHLC data from Kraken", e);
            }
        }
        throw lastError != null
                ? lastError
                : new KrakenApiException("Kraken rate limit exceeded after retries");
    }

    private static boolean isRateLimited(JsonNode body) {
        return hasRateLimitError(body.get(KRAKEN_ERROR_FIELD));
    }

    private static boolean hasRateLimitError(JsonNode errors) {
        if (errors == null || !errors.isArray() || errors.isEmpty()) {
            return false;
        }
        for (JsonNode error : errors) {
            if (error.asText().contains("Too many requests")) {
                return true;
            }
        }
        return false;
    }

    private OhlcPage parseOhlcPage(JsonNode body, String krakenPair) {
        JsonNode result = body.get("result");
        if (result == null || result.isNull()) {
            throw new KrakenApiException("Kraken OHLC response missing result");
        }

        JsonNode candles = result.get(krakenPair);
        if (candles == null || !candles.isArray()) {
            candles = findCandleArray(result);
        }

        List<OhlcDto> ohlcList = new ArrayList<>();
        for (JsonNode candle : candles) {
            ohlcList.add(parseCandle(candle));
        }

        Long lastId = result.has("last") && !result.get("last").isNull()
                ? result.get("last").asLong()
                : null;
        return new OhlcPage(ohlcList, lastId);
    }

    private JsonNode findCandleArray(JsonNode result) {
        Iterator<String> fieldNames = result.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            if (!"last".equals(field)) {
                JsonNode node = result.get(field);
                if (node != null && node.isArray()) {
                    return node;
                }
            }
        }
        throw new KrakenApiException("No OHLC candle data in Kraken response");
    }

    private OhlcDto parseCandle(JsonNode candle) {
        long timestampMs = candle.get(0).asLong() * 1000L;
        BigDecimal volume = candle.size() > 6
                ? new BigDecimal(candle.get(6).asText())
                : BigDecimal.ZERO;
        return new OhlcDto(
                timestampMs,
                new BigDecimal(candle.get(1).asText()),
                new BigDecimal(candle.get(2).asText()),
                new BigDecimal(candle.get(3).asText()),
                new BigDecimal(candle.get(4).asText()),
                volume);
    }

    private void validateKrakenResponse(JsonNode body) {
        JsonNode errors = body.get(KRAKEN_ERROR_FIELD);
        if (errors != null && errors.isArray() && !errors.isEmpty()) {
            throw new KrakenApiException("Kraken API error: " + errors);
        }
    }

    record OhlcPage(List<OhlcDto> candles, Long lastId) {
    }
}
