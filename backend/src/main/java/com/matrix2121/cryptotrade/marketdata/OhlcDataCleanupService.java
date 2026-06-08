package com.matrix2121.cryptotrade.marketdata;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class OhlcDataCleanupService {

    private final OhlcDataRepository ohlcDataRepository;
    private final TrackedSymbolsService trackedSymbolsService;

    public OhlcDataCleanupService(
            OhlcDataRepository ohlcDataRepository,
            TrackedSymbolsService trackedSymbolsService) {
        this.ohlcDataRepository = ohlcDataRepository;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    @Scheduled(cron = "0 30 0 * * ?")
    @Transactional
    public void cleanupStaleOhlc() {
        runCleanup();
    }

    @Transactional
    public void runCleanup() {
        long nowMs = System.currentTimeMillis();
        long totalDeleted = 0;

        for (String symbol : trackedSymbolsService.getSymbols()) {
            for (OhlcIntervalPolicy.IntervalSpec spec : OhlcIntervalPolicy.intervalsWithRetention()) {
                long cutoff = nowMs - spec.retentionMs().orElseThrow();
                long deleted = ohlcDataRepository.deleteBySymbolAndIntervalStringAndTimestampLessThan(
                        symbol, spec.intervalString(), cutoff);
                if (deleted > 0) {
                    log.info("Cleanup removed {} {} candles for {} older than {}",
                            deleted, spec.intervalString(), symbol, cutoff);
                    totalDeleted += deleted;
                }
            }
        }

        if (totalDeleted > 0) {
            log.info("OHLC cleanup complete: removed {} rows", totalDeleted);
        } else {
            log.debug("OHLC cleanup complete: nothing to remove");
        }
    }
}
