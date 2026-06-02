package com.matrix2121.cryptotrade.history;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final ChartHistoryService chartHistoryService;
    private final ChartDataService chartDataService;
    private final MarketDataSyncService marketDataSyncService;
    private final LiveTickCacheService liveTickCacheService;
    private final AtomicBoolean syncInProgress = new AtomicBoolean(false);

    public HistoryController(
            ChartHistoryService chartHistoryService,
            ChartDataService chartDataService,
            MarketDataSyncService marketDataSyncService,
            LiveTickCacheService liveTickCacheService) {
        this.chartHistoryService = chartHistoryService;
        this.chartDataService = chartDataService;
        this.marketDataSyncService = marketDataSyncService;
        this.liveTickCacheService = liveTickCacheService;
    }

    /**
     * Unified DB-backed chart endpoint consumed by the frontend dictionary cache.
     * Returns List&lt;TickDto&gt; for tick ranges and List&lt;OhlcDto&gt; for OHLC ranges.
     */
    @GetMapping("/{symbol}")
    public ResponseEntity<Object> getByRange(
            @PathVariable String symbol,
            @RequestParam("range") String range) {
        String formattedSymbol = symbol.replace("-", "/").toUpperCase();
        if (!chartDataService.isKnownRange(range)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(chartDataService.getByRange(formattedSymbol, range));
    }

    @GetMapping("/{symbol}/ticks")
    public ResponseEntity<List<TickDto>> getTicks(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "5") int minutes) {
        String formattedSymbol = symbol.replace("-", "/").toUpperCase();
        return ResponseEntity.ok(chartHistoryService.getTicks(formattedSymbol, minutes));
    }

    @GetMapping("/{symbol}/ohlc")
    public ResponseEntity<List<OhlcDto>> getOhlc(
            @PathVariable String symbol,
            @RequestParam int interval) {
        String formattedSymbol = symbol.replace("-", "/").toUpperCase();
        return ResponseEntity.ok(chartHistoryService.getOhlc(formattedSymbol, interval));
    }

    /**
     * Returns the rolling 15-minute in-memory tick window plus all derived 15-second candles
     * for the given symbol. Data is sourced exclusively from RAM — no DB query.
     *
     * Response shape: { "ticks": [...TickDto], "candles15s": [...OhlcDto] }
     */
    @GetMapping("/live-context/{symbol}")
    public ResponseEntity<Map<String, Object>> getLiveContext(@PathVariable String symbol) {
        String formattedSymbol = symbol.replace("-", "/").toUpperCase();
        List<TickDto> ticks = liveTickCacheService.getAllTicks(formattedSymbol);
        List<OhlcDto> candles = liveTickCacheService.getCandles15s(formattedSymbol);
        return ResponseEntity.ok(Map.of("ticks", ticks, "candles15s", candles));
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> triggerSync() {
        if (!syncInProgress.compareAndSet(false, true)) {
            return ResponseEntity.status(409).build();
        }
        CompletableFuture.runAsync(() -> {
            try {
                marketDataSyncService.syncAll();
            } finally {
                syncInProgress.set(false);
            }
        });
        return ResponseEntity.accepted().build();
    }
}
