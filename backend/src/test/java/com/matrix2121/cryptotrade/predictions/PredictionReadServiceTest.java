package com.matrix2121.cryptotrade.predictions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@ExtendWith(MockitoExtension.class)
class PredictionReadServiceTest {

    @Mock
    private PredictionRepository predictionRepository;

    private PredictionReadService predictionReadService;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        predictionReadService = new PredictionReadService(
                predictionRepository,
                new PredictionResponseMapper(objectMapper),
                objectMapper);
    }

    @Test
    void getLatest_mergesHourlyOverlayOntoDaily() {
        OffsetDateTime dailyTs = OffsetDateTime.parse("2026-06-08T00:00:00Z");
        OffsetDateTime hourlyTs = OffsetDateTime.parse("2026-06-08T14:00:00Z");

        PredictionRow daily = sampleRow(
                1L,
                dailyTs,
                null,
                new BigDecimal("100000"),
                new BigDecimal("99000"),
                new BigDecimal("101000"));
        PredictionRow hourly = sampleRow(
                2L,
                hourlyTs,
                new BigDecimal("99500"),
                null,
                null,
                null);

        when(predictionRepository.findLatestHourly("BTC/USD")).thenReturn(Optional.of(hourly));
        when(predictionRepository.findLatestDaily("BTC/USD")).thenReturn(Optional.of(daily));

        ObjectNode result = predictionReadService.getLatest("BTC/USD");

        assertEquals("BTC/USD", result.get("asset").asText());
        assertEquals(hourlyTs.toString(), result.get("predictedAt").asText());
        assertEquals(99500.0, result.get("ml1hPrediction").get("price").asDouble());
        assertEquals(100000.0, result.get("mlPrediction").get("price").asDouble());
    }

    @Test
    void getLatest_hourlyOnly() {
        OffsetDateTime hourlyTs = OffsetDateTime.parse("2026-06-08T14:00:00Z");
        PredictionRow hourly = sampleRow(
                2L,
                hourlyTs,
                new BigDecimal("99500"),
                null,
                null,
                null);

        when(predictionRepository.findLatestHourly("BTC/USD")).thenReturn(Optional.of(hourly));
        when(predictionRepository.findLatestDaily("BTC/USD")).thenReturn(Optional.empty());

        ObjectNode result = predictionReadService.getLatest("BTC/USD");

        assertNotNull(result.get("ml1hPrediction"));
        assertTrue(result.get("mlPrediction").get("price").isNull());
    }

    @Test
    void getLatest_noRows_returns404() {
        when(predictionRepository.findLatestHourly("BTC/USD")).thenReturn(Optional.empty());
        when(predictionRepository.findLatestDaily("BTC/USD")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> predictionReadService.getLatest("BTC/USD"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void getHistory_mapsEachRow() {
        PredictionRow row = sampleRow(
                1L,
                OffsetDateTime.parse("2026-06-08T00:00:00Z"),
                null,
                new BigDecimal("100000"),
                new BigDecimal("99000"),
                new BigDecimal("101000"));
        when(predictionRepository.findHistory("BTC/USD", 10)).thenReturn(List.of(row));

        var result = predictionReadService.getHistory("BTC/USD", 10);

        assertEquals(1, result.size());
        assertEquals(100000.0, result.get(0).get("mlPrediction").get("price").asDouble());
    }

    private static PredictionRow sampleRow(
            Long id,
            OffsetDateTime predictedAt,
            BigDecimal ml1hPrice,
            BigDecimal mlPrice,
            BigDecimal mlCiLow,
            BigDecimal mlCiHigh) {
        return new PredictionRow(
                id,
                "BTC/USD",
                predictedAt,
                "scheduled",
                true,
                ml1hPrice,
                ml1hPrice != null ? ml1hPrice.subtract(new BigDecimal("500")) : null,
                ml1hPrice != null ? ml1hPrice.add(new BigDecimal("500")) : null,
                mlPrice,
                mlCiLow,
                mlCiHigh,
                mlPrice,
                mlCiLow,
                mlCiHigh,
                "{\"sentimentBias\":\"neutral\",\"priceDirection\":\"up\",\"confidence\":0.7}",
                "{}",
                "{\"priceAdjustmentPct\":0.01}",
                "[]",
                null);
    }
}
