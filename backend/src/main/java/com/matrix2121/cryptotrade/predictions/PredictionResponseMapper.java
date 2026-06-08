package com.matrix2121.cryptotrade.predictions;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Component
public class PredictionResponseMapper {

    private final ObjectMapper objectMapper;

    public PredictionResponseMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ObjectNode toResponse(PredictionRow row) {
        ObjectNode out = objectMapper.createObjectNode();
        out.put("id", row.id());
        out.put("asset", row.asset());
        if (row.predictedAt() != null) {
            out.put("predicted_at", row.predictedAt().toString());
            out.put("predictedAt", row.predictedAt().toString());
        }
        out.put("source", row.source());
        out.put("use_rag", row.useRag());
        out.put("useRag", row.useRag());

        putDecimal(out, "ml_1h_price", row.ml1hPrice());
        putDecimal(out, "ml_1h_ci_low", row.ml1hCiLow());
        putDecimal(out, "ml_1h_ci_high", row.ml1hCiHigh());
        putDecimal(out, "ml_price", row.mlPrice());
        putDecimal(out, "ml_ci_low", row.mlCiLow());
        putDecimal(out, "ml_ci_high", row.mlCiHigh());
        putDecimal(out, "context_aware_price", row.contextAwarePrice());
        putDecimal(out, "context_aware_ci_low", row.contextAwareCiLow());
        putDecimal(out, "context_aware_ci_high", row.contextAwareCiHigh());
        putDecimal(out, "actual_price_24h", row.actualPrice24h());

        JsonNode contextPredictionJson = parseJson(row.contextPredictionJson());
        JsonNode contextSnapshotJson = parseJson(row.contextSnapshotJson());
        JsonNode tuningParamsJson = parseJson(row.tuningParamsJson());
        JsonNode ragPrecedentsJson = parseJson(row.ragPrecedentsJson());

        out.set("context_prediction_json", contextPredictionJson);
        out.set("context_snapshot_json", contextSnapshotJson);
        out.set("tuning_params_json", tuningParamsJson);
        out.set("rag_precedents_json", ragPrecedentsJson);

        if (row.ml1hPrice() != null) {
            ObjectNode ml1h = out.putObject("ml1hPrediction");
            ml1h.put("horizonHours", 1);
            putDecimal(ml1h, "price", row.ml1hPrice());
            putDecimal(ml1h, "ciLow", row.ml1hCiLow());
            putDecimal(ml1h, "ciHigh", row.ml1hCiHigh());
        }

        ObjectNode mlPrediction = out.putObject("mlPrediction");
        mlPrediction.put("horizonHours", 24);
        putDecimal(mlPrediction, "price", row.mlPrice());
        putDecimal(mlPrediction, "ciLow", row.mlCiLow());
        putDecimal(mlPrediction, "ciHigh", row.mlCiHigh());

        ObjectNode contextAware = out.putObject("contextAwarePrediction");
        contextAware.put("horizonHours", 24);
        putDecimal(contextAware, "price", row.contextAwarePrice());
        putDecimal(contextAware, "ciLow", row.contextAwareCiLow());
        putDecimal(contextAware, "ciHigh", row.contextAwareCiHigh());

        if (contextPredictionJson != null && contextPredictionJson.isObject()) {
            ObjectNode ctxPred = out.putObject("contextPrediction");
            ctxPred.set("sentimentBias", firstNonNull(
                    contextPredictionJson.get("sentimentBias"),
                    contextPredictionJson.get("sentiment_bias")));
            ctxPred.set("priceDirection", firstNonNull(
                    contextPredictionJson.get("priceDirection"),
                    contextPredictionJson.get("price_direction")));
            ctxPred.set("magnitudeEstimatePct", firstNonNull(
                    contextPredictionJson.get("magnitudeEstimatePct"),
                    contextPredictionJson.get("magnitude_estimate_pct")));
            ctxPred.set("confidence", contextPredictionJson.get("confidence"));
            ctxPred.set("reasoning", contextPredictionJson.get("reasoning"));
            JsonNode sources = firstNonNull(
                    contextPredictionJson.get("sourcesUsed"),
                    contextPredictionJson.get("sources_used"));
            if (sources != null && sources.isArray()) {
                ctxPred.set("sourcesUsed", sources);
            } else {
                ctxPred.set("sourcesUsed", objectMapper.createArrayNode());
            }
        }

        out.set("contextSnapshot", contextSnapshotJson != null ? contextSnapshotJson : objectMapper.createObjectNode());
        if (ragPrecedentsJson != null && ragPrecedentsJson.isArray()) {
            out.set("ragPrecedents", ragPrecedentsJson);
        } else {
            out.set("ragPrecedents", objectMapper.createArrayNode());
        }

        if (tuningParamsJson != null && tuningParamsJson.isObject()) {
            ObjectNode tuning = out.putObject("tuningApplied");
            tuning.set("priceAdjustmentPct", firstNonNull(
                    tuningParamsJson.get("priceAdjustmentPct"),
                    tuningParamsJson.get("price_adjustment_pct")));
            tuning.set("ciExpansion", firstNonNull(
                    tuningParamsJson.get("ciExpansion"),
                    tuningParamsJson.get("ci_expansion")));
            tuning.set("reasoning", tuningParamsJson.get("reasoning"));
        }

        return out;
    }

    private JsonNode parseJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static JsonNode firstNonNull(JsonNode first, JsonNode second) {
        if (first != null && !first.isNull()) {
            return first;
        }
        return second;
    }

    private static void putDecimal(ObjectNode node, String field, BigDecimal value) {
        if (value != null) {
            node.put(field, value.doubleValue());
        } else {
            node.putNull(field);
        }
    }
}
