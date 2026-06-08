package com.matrix2121.cryptotrade.predictions;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {

    private final PredictionReadService predictionReadService;
    private final MlServiceClient mlServiceClient;
    private final TrackedSymbolsService trackedSymbolsService;

    public PredictionController(
            PredictionReadService predictionReadService,
            MlServiceClient mlServiceClient,
            TrackedSymbolsService trackedSymbolsService) {
        this.predictionReadService = predictionReadService;
        this.mlServiceClient = mlServiceClient;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    @GetMapping("/{symbol}/latest")
    public ResponseEntity<JsonNode> latest(@PathVariable String symbol) {
        String resolved = resolveSymbol(symbol);
        return ResponseEntity.ok(predictionReadService.getLatest(resolved));
    }

    @GetMapping("/{symbol}/history")
    public ResponseEntity<JsonNode> history(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "50") int limit) {
        String resolved = resolveSymbol(symbol);
        return ResponseEntity.ok(predictionReadService.getHistory(resolved, limit));
    }

    @GetMapping("/backtest/summary")
    public ResponseEntity<JsonNode> backtestSummary(@RequestParam(required = false) String asset) {
        return ResponseEntity.ok(mlServiceClient.getBacktestSummary(asset));
    }

    @GetMapping("/backtest/drift/{symbol}")
    public ResponseEntity<JsonNode> drift(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "7") int days) {
        String resolved = resolveSymbol(symbol);
        return ResponseEntity.ok(mlServiceClient.getDrift(resolved, days));
    }

    private String resolveSymbol(String symbol) {
        return trackedSymbolsService.resolveFromPath(symbol)
                .orElse(symbol.replace("-", "/").toUpperCase());
    }
}
