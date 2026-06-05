package com.matrix2121.cryptotrade.marketdata;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;

@RestController
@RequestMapping("/api/history")
public class ChartController {

    private final ChartDataService chartDataService;
    private final LiveTickCacheService liveTickCacheService;

    public ChartController(
            ChartDataService chartDataService,
            LiveTickCacheService liveTickCacheService) {
        this.chartDataService = chartDataService;
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

}
