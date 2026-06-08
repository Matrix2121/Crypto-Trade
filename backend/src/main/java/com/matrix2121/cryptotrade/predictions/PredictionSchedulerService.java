package com.matrix2121.cryptotrade.predictions;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class PredictionSchedulerService {

    private final MlServiceClient mlServiceClient;

    public PredictionSchedulerService(MlServiceClient mlServiceClient) {
        this.mlServiceClient = mlServiceClient;
    }

    @Scheduled(cron = "0 0 * * * ?")
    public void hourlyPredictions() {
        try {
            log.info("Triggering hourly 1h ML batch predictions");
            mlServiceClient.triggerHourlyBatchPredict();
        } catch (Exception e) {
            log.error("Hourly prediction job failed: {}", e.getMessage(), e);
        }
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void dailyPredictions() {
        try {
            log.info("Triggering daily 24h context-aware ML batch predictions");
            mlServiceClient.triggerDailyBatchPredict();
        } catch (Exception e) {
            log.error("Daily prediction job failed: {}", e.getMessage(), e);
        }
    }

    @Scheduled(cron = "0 30 * * * ?")
    public void backfillActuals() {
        try {
            log.info("Backfilling prediction actuals and RAG index");
            mlServiceClient.backfillActuals();
        } catch (Exception e) {
            log.error("Prediction backfill job failed: {}", e.getMessage(), e);
        }
    }
}
