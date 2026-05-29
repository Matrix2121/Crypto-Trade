package com.matrix2121.cryptotrade.history;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoricalPriceService historicalPriceService;

    @Autowired
    public HistoryController(HistoricalPriceService historicalPriceService) {
        this.historicalPriceService = historicalPriceService;
    }

    @GetMapping("/{symbol}")
    public ResponseEntity<List<HistoricalPriceDto>> getChartData(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int interval) {
        String normalizedSymbol = symbol.replace('-', '/').toUpperCase();
        return ResponseEntity.ok(historicalPriceService.getChartData(normalizedSymbol, interval));
    }
}
