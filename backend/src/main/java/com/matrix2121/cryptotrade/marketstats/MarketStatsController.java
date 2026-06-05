package com.matrix2121.cryptotrade.marketstats;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.marketstats.dto.TrackedAssetDto;

@RestController
@RequestMapping("/api/market-stats")
public class MarketStatsController {

    private final MarketStatsService marketStatsService;

    public MarketStatsController(MarketStatsService marketStatsService) {
        this.marketStatsService = marketStatsService;
    }

    @GetMapping("/global")
    public ResponseEntity<List<TrackedAssetDto>> getGlobal() {
        return ResponseEntity.ok(marketStatsService.getAllTrackedAssets());
    }

    @GetMapping("/{symbol}")
    public ResponseEntity<TrackedAssetDto> getBySymbol(@PathVariable String symbol) {
        return marketStatsService.getTrackedAsset(symbol)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
