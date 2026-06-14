package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;

@ExtendWith(MockitoExtension.class)
class KrakenOhlcClientTest {

    private static final String PAIR = "XXBTZUSD";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private KrakenApiThrottle throttle;

    private KrakenOhlcClient client;

    @BeforeEach
    void setUp() {
        client = new KrakenOhlcClient(throttle, restTemplate);
    }

    @Test
    void fetchOhlcSince_paginatesForwardUsingLastCursor() throws Exception {
        List<OhlcDto> page1Candles = new ArrayList<>();
        for (int i = 0; i < 720; i++) {
            long ts = 1_000L + i * 60L;
            page1Candles.add(candle(ts, String.valueOf(100 + i)));
        }
        long page1Last = 1_000L + 719 * 60L;
        JsonNode page1 = response(page1Candles, page1Last);
        JsonNode page2 = response(candle(1_000L + 720 * 60L, "900"), 1_000L + 720 * 60L);

        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(page1, page2);

        List<OhlcDto> candles = client.fetchOhlcSince("BTC/USD", 1, 1_000L);

        assertEquals(721, candles.size());
        assertEquals(1_000_000L, candles.get(0).timestamp());
        assertEquals((1_000L + 720 * 60L) * 1000L, candles.get(720).timestamp());
        verify(restTemplate, times(2)).getForObject(any(URI.class), eq(JsonNode.class));
    }

    @Test
    void fetchOhlcSince_excludesCandlesBeforeSinceSeconds() throws Exception {
        JsonNode page = response(
                candle(900L, "90"),
                candle(1_000L, "100"),
                1_000L);

        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(page);

        List<OhlcDto> candles = client.fetchOhlcSince("BTC/USD", 1, 1_000L);

        assertEquals(1, candles.size());
        assertEquals(1_000_000L, candles.get(0).timestamp());
    }

    @Test
    void fetchOhlcSince_stopsWhenLastCursorDoesNotAdvance() throws Exception {
        JsonNode page = response(
                candle(1_000L, "100"),
                candle(1_060L, "101"),
                1_000L);

        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(page);

        List<OhlcDto> candles = client.fetchOhlcSince("BTC/USD", 1, 1_000L);

        assertEquals(2, candles.size());
        verify(restTemplate, times(1)).getForObject(any(URI.class), eq(JsonNode.class));
    }

    @Test
    void fetchOhlcSince_stopsOnPartialPage() throws Exception {
        JsonNode page = response(
                candle(1_000L, "100"),
                1_000L);

        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(page);

        List<OhlcDto> candles = client.fetchOhlcSince("BTC/USD", 1, 1_000L);

        assertEquals(1, candles.size());
        verify(restTemplate, times(1)).getForObject(any(URI.class), eq(JsonNode.class));
    }

    @Test
    void fetchOhlcSince_returnsEmptyWhenFirstPageEmpty() throws Exception {
        JsonNode page = response(1_000L);

        when(restTemplate.getForObject(any(URI.class), eq(JsonNode.class)))
                .thenReturn(page);

        List<OhlcDto> candles = client.fetchOhlcSince("BTC/USD", 1, 1_000L);

        assertTrue(candles.isEmpty());
    }

    private static JsonNode response(long lastId) throws Exception {
        return MAPPER.readTree("""
                {
                  "error": [],
                  "result": {
                    "%s": [],
                    "last": %d
                  }
                }
                """.formatted(PAIR, lastId));
    }

    private static JsonNode response(OhlcDto candle, long lastId) throws Exception {
        return response(List.of(candle), lastId);
    }

    private static JsonNode response(OhlcDto first, OhlcDto second, long lastId) throws Exception {
        return response(List.of(first, second), lastId);
    }

    private static JsonNode response(List<OhlcDto> candles, long lastId) throws Exception {
        StringBuilder array = new StringBuilder("[");
        for (int i = 0; i < candles.size(); i++) {
            OhlcDto candle = candles.get(i);
            if (i > 0) {
                array.append(',');
            }
            array.append('[')
                    .append(candle.timestamp() / 1000L).append(',')
                    .append('"').append(candle.open()).append('"').append(',')
                    .append('"').append(candle.high()).append('"').append(',')
                    .append('"').append(candle.low()).append('"').append(',')
                    .append('"').append(candle.close()).append('"').append(',')
                    .append('"').append(candle.close()).append('"').append(',')
                    .append('"').append(candle.volume()).append('"').append(',')
                    .append("0]");
        }
        array.append(']');

        return MAPPER.readTree("""
                {
                  "error": [],
                  "result": {
                    "%s": %s,
                    "last": %d
                  }
                }
                """.formatted(PAIR, array, lastId));
    }

    private static OhlcDto candle(long timestampSec, String close) {
        BigDecimal price = new BigDecimal(close);
        return new OhlcDto(
                timestampSec * 1000L,
                price,
                price,
                price,
                price,
                BigDecimal.ONE);
    }
}
