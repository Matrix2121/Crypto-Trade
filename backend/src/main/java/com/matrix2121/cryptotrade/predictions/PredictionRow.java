package com.matrix2121.cryptotrade.predictions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PredictionRow(
        Long id,
        String asset,
        OffsetDateTime predictedAt,
        String source,
        Boolean useRag,
        BigDecimal ml1hPrice,
        BigDecimal ml1hCiLow,
        BigDecimal ml1hCiHigh,
        BigDecimal mlPrice,
        BigDecimal mlCiLow,
        BigDecimal mlCiHigh,
        BigDecimal contextAwarePrice,
        BigDecimal contextAwareCiLow,
        BigDecimal contextAwareCiHigh,
        String contextPredictionJson,
        String contextSnapshotJson,
        String tuningParamsJson,
        String ragPrecedentsJson,
        BigDecimal actualPrice24h) {

    public PredictionRow withHourlyOverlay(PredictionRow hourly) {
        OffsetDateTime mergedTs = predictedAt;
        if (hourly.predictedAt() != null
                && (mergedTs == null || hourly.predictedAt().isAfter(mergedTs))) {
            mergedTs = hourly.predictedAt();
        }
        return new PredictionRow(
                id,
                asset,
                mergedTs,
                source,
                useRag,
                hourly.ml1hPrice(),
                hourly.ml1hCiLow(),
                hourly.ml1hCiHigh(),
                mlPrice,
                mlCiLow,
                mlCiHigh,
                contextAwarePrice,
                contextAwareCiLow,
                contextAwareCiHigh,
                contextPredictionJson,
                contextSnapshotJson,
                tuningParamsJson,
                ragPrecedentsJson,
                actualPrice24h);
    }
}
