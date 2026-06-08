package com.matrix2121.cryptotrade.predictions;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;

@Component
public class MlServiceClient {

    private final RestClient restClient;

    public MlServiceClient(@Value("${ml.service.url:http://localhost:8000}") String baseUrl) {
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    public JsonNode getBacktestSummary(String symbol) {
        String uri = symbol != null
                ? "/backtest/summary?asset=" + symbol
                : "/backtest/summary";
        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getDrift(String symbol, int days) {
        return restClient.get()
                .uri("/backtest/drift/{asset}?days={days}", symbol, days)
                .retrieve()
                .body(JsonNode.class);
    }

    public void triggerHourlyBatchPredict() {
        triggerHourlyBatchPredict("scheduled");
    }

    public void triggerHourlyBatchPredict(String source) {
        restClient.post()
                .uri("/predict/batch/hourly?source={source}&align=next_hour", source)
                .retrieve()
                .toBodilessEntity();
    }

    public void triggerDailyBatchPredict() {
        triggerDailyBatchPredict("scheduled");
    }

    public void triggerDailyBatchPredict(String source) {
        restClient.post()
                .uri("/predict/batch/daily?use_rag=true&source={source}&align=midnight", source)
                .retrieve()
                .toBodilessEntity();
    }

    public void backfillActuals() {
        restClient.post()
                .uri("/backfill/actuals")
                .retrieve()
                .toBodilessEntity();
    }
}
