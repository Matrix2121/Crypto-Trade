package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.TreeMap;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.exceptions.KrakenApiException;
import com.matrix2121.cryptotrade.history.OhlcDto;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class KrakenOhlcClient {

    private static final String OHLC_URL = "https://api.kraken.com/0/public/OHLC";
    private static final String KRAKEN_ERROR_FIELD = "error";
    private static final int KRAKEN_PAGE_SIZE = 720;
    private static final int MAX_RATE_LIMIT_RETRIES = 6;

    private final RestTemplate restTemplate;
    private final KrakenApiThrottle throttle;

    public KrakenOhlcClient(KrakenApiThrottle throttle) {
        this.restTemplate = new RestTemplate();
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
        return parseOhlc(body, krakenPair);
    }

    /**
     * Fetches OHLC from sinceSeconds through now. Kraken returns at most 720
     * candles per
     * request and ignores very old {@code since} values (returns the latest 720
     * instead).
     * We walk backward in 720-candle windows so 5-year daily syncs receive the full
     * range.
     */
    public List<OhlcDto> fetchOhlcSince(String symbol, int interval, long sinceSeconds) {
        String krakenPair = KrakenPairMapper.toKrakenPair(symbol);
        long intervalSec = interval * 60L;
        long chunkWidthSec = KRAKEN_PAGE_SIZE * intervalSec;
        long endExclusiveSec = Instant.now().getEpochSecond() + intervalSec;

        TreeMap<Long, OhlcDto> byTimestamp = new TreeMap<>();
        long cursor = endExclusiveSec;
        boolean hasMore = true;

        while (cursor > sinceSeconds && hasMore) {
            long chunkStart = Math.max(sinceSeconds, cursor - chunkWidthSec);
            List<OhlcDto> page = fetchOhlcPage(krakenPair, interval);

            if (page.isEmpty()) {
                hasMore = false;
            } else {
                long pageMinSec = mergePageIntoMap(page, chunkStart, cursor, byTimestamp);
                cursor = nextCursor(chunkStart, sinceSeconds, intervalSec, pageMinSec);
                hasMore = cursor > sinceSeconds && pageMinSec > sinceSeconds + intervalSec;
            }
        }

        return new ArrayList<>(byTimestamp.values());
    }

    private static long mergePageIntoMap(
            List<OhlcDto> page,
            long chunkStart,
            long cursor,
            TreeMap<Long, OhlcDto> byTimestamp) {
        long pageMinSec = Long.MAX_VALUE;
        for (OhlcDto candle : page) {
            long tsSec = candle.timestamp() / 1000L;
            pageMinSec = Math.min(pageMinSec, tsSec);
            if (tsSec >= chunkStart && tsSec < cursor) {
                byTimestamp.put(candle.timestamp(), candle);
            }
        }
        return pageMinSec;
    }

    private static long nextCursor(
            long chunkStart,
            long sinceSeconds,
            long intervalSec,
            long pageMinSec) {
        if (pageMinSec <= sinceSeconds + intervalSec) {
            return sinceSeconds;
        }
        // Kraken ignored chunkStart and returned only the latest window — step back
        // from oldest candle.
        if (pageMinSec > chunkStart + intervalSec) {
            return pageMinSec;
        }
        return chunkStart;
    }

    private List<OhlcDto> fetchOhlcPage(String krakenPair, int interval) {
        URI uri = UriComponentsBuilder.fromUriString(OHLC_URL)
                .queryParam("pair", krakenPair)
                .queryParam("interval", interval)
                .build()

                .toUri();
        JsonNode body = getKrakenJson(uri);
        return parseOhlc(body, krakenPair);
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

    private List<OhlcDto> parseOhlc(JsonNode body, String krakenPair) {
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
        return ohlcList;
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
        return new OhlcDto(
                timestampMs,
                new BigDecimal(candle.get(1).asText()),
                new BigDecimal(candle.get(2).asText()),
                new BigDecimal(candle.get(3).asText()),
                new BigDecimal(candle.get(4).asText()));
    }

    private void validateKrakenResponse(JsonNode body) {
        JsonNode errors = body.get(KRAKEN_ERROR_FIELD);
        if (errors != null && errors.isArray() && !errors.isEmpty()) {
            throw new KrakenApiException("Kraken API error: " + errors);
        }
    }
}
