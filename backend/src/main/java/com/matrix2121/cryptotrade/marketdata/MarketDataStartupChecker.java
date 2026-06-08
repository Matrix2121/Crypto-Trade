package com.matrix2121.cryptotrade.marketdata;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * On application start, checks OHLC freshness and triggers a background sync when stale.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "market-data.startup-check.enabled", havingValue = "true", matchIfMissing = true)
public class MarketDataStartupChecker implements ApplicationListener<ApplicationReadyEvent> {

    private final MarketDataFreshnessService freshnessService;
    private final MarketDataSyncService marketDataSyncService;

    public MarketDataStartupChecker(
            MarketDataFreshnessService freshnessService,
            MarketDataSyncService marketDataSyncService) {
        this.freshnessService = freshnessService;
        this.marketDataSyncService = marketDataSyncService;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll();

        if (!report.isAnyStale()) {
            log.info(
                    "OHLC data fresh for all {} tracked symbols — skipping startup sync",
                    report.totalSymbols());
            return;
        }

        for (MarketDataFreshnessService.SymbolFreshness symbolFreshness : report.staleSymbols()) {
            logStaleSymbol(symbolFreshness);
        }

        boolean started = marketDataSyncService.runSyncAsync("startup");
        if (started) {
            log.info(
                    "Startup OHLC sync scheduled for {} stale symbol(s) out of {}",
                    report.staleSymbols().size(),
                    report.totalSymbols());
        } else {
            log.warn(
                    "OHLC data stale on startup but sync already in progress — "
                            + "{} symbol(s) need refresh",
                    report.staleSymbols().size());
        }
    }

    private static void logStaleSymbol(MarketDataFreshnessService.SymbolFreshness symbolFreshness) {
        StringBuilder details = new StringBuilder();
        for (MarketDataFreshnessService.StaleInterval stale : symbolFreshness.staleIntervals()) {
            if (!details.isEmpty()) {
                details.append(", ");
            }
            details.append(stale.intervalString())
                    .append(" last=")
                    .append(stale.lastTimestampIso())
                    .append(" lagMs=")
                    .append(stale.lagMs());
        }
        log.warn("OHLC stale for {}: {}", symbolFreshness.symbol(), details);
    }
}
