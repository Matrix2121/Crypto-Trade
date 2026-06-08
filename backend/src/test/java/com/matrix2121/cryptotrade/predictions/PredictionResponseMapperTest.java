package com.matrix2121.cryptotrade.predictions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

class PredictionResponseMapperTest {

    private PredictionResponseMapper mapper;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        mapper = new PredictionResponseMapper(objectMapper);
    }

    @Test
    void toResponse_mapsContextPredictionFromJsonb() {
        PredictionRow row = new PredictionRow(
                1L,
                "ETH/USD",
                OffsetDateTime.parse("2026-06-08T00:00:00Z"),
                "admin",
                true,
                null,
                null,
                null,
                new BigDecimal("3500"),
                new BigDecimal("3400"),
                new BigDecimal("3600"),
                new BigDecimal("3520"),
                new BigDecimal("3410"),
                new BigDecimal("3610"),
                "{\"sentiment_bias\":\"bullish\",\"price_direction\":\"up\",\"magnitude_estimate_pct\":2.5,\"confidence\":0.8,\"reasoning\":\"test\",\"sources_used\":[\"news\"]}",
                "{\"headlines\":[]}",
                "{\"price_adjustment_pct\":0.02,\"ci_expansion\":1.1,\"reasoning\":\"tuned\"}",
                "[{\"asset\":\"ETH/USD\"}]",
                null);

        ObjectNode out = mapper.toResponse(row);

        assertEquals("ETH/USD", out.get("asset").asText());
        assertEquals("bullish", out.get("contextPrediction").get("sentimentBias").asText());
        assertEquals("up", out.get("contextPrediction").get("priceDirection").asText());
        assertEquals(2.5, out.get("contextPrediction").get("magnitudeEstimatePct").asDouble());
        assertEquals(1, out.get("ragPrecedents").size());
        assertEquals(0.02, out.get("tuningApplied").get("priceAdjustmentPct").asDouble());
        assertNotNull(out.get("contextSnapshot"));
    }

    @Test
    void toResponse_includesHourlyPredictionWhenPresent() {
        PredictionRow row = new PredictionRow(
                1L,
                "BTC/USD",
                OffsetDateTime.parse("2026-06-08T13:00:00Z"),
                "scheduled",
                true,
                new BigDecimal("99000"),
                new BigDecimal("98500"),
                new BigDecimal("99500"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);

        ObjectNode out = mapper.toResponse(row);

        assertEquals(99000.0, out.get("ml1hPrediction").get("price").asDouble());
        assertEquals(1, out.get("ml1hPrediction").get("horizonHours").asInt());
    }
}
