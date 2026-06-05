package com.matrix2121.cryptotrade.marketstats;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbols;
import com.matrix2121.cryptotrade.marketstats.dto.TrackedAssetDto;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

@RestController
@RequestMapping("/api/market-stats")
public class MarketStatsController {

    private final TrackedAssetRepository trackedAssetRepository;

    public MarketStatsController(TrackedAssetRepository trackedAssetRepository) {
        this.trackedAssetRepository = trackedAssetRepository;
    }

    @GetMapping("/global")
    public ResponseEntity<List<TrackedAssetDto>> getGlobal() {
        List<TrackedAssetDto> assets = trackedAssetRepository.findAll().stream()
                .map(TrackedAssetDto::from)
                .toList();
        return ResponseEntity.ok(assets);
    }

    @GetMapping("/{symbol}")
    public ResponseEntity<TrackedAssetDto> getBySymbol(@PathVariable String symbol) {
        return TrackedSymbols.resolveFromPath(symbol)
                .flatMap(trackedAssetRepository::findById)
                .map(TrackedAssetDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
