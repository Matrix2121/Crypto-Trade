package com.matrix2121.cryptotrade.admin;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.admin.dto.AddTrackedCryptoRequest;
import com.matrix2121.cryptotrade.marketdata.MarketDataSyncService;
import com.matrix2121.cryptotrade.marketstats.MarketStatsService;
import com.matrix2121.cryptotrade.marketstats.MarketStatsSyncService;
import com.matrix2121.cryptotrade.marketstats.dto.TrackedAssetDto;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final MarketStatsService marketStatsService;
    private final AdminTrackedCryptoService adminTrackedCryptoService;
    private final MarketDataSyncService marketDataSyncService;
    private final MarketStatsSyncService marketStatsSyncService;
    private final AtomicBoolean historySyncInProgress = new AtomicBoolean(false);
    private final AtomicBoolean statsSyncInProgress = new AtomicBoolean(false);

    public AdminController(
            MarketStatsService marketStatsService,
            AdminTrackedCryptoService adminTrackedCryptoService,
            MarketDataSyncService marketDataSyncService,
            MarketStatsSyncService marketStatsSyncService) {
        this.marketStatsService = marketStatsService;
        this.adminTrackedCryptoService = adminTrackedCryptoService;
        this.marketDataSyncService = marketDataSyncService;
        this.marketStatsSyncService = marketStatsSyncService;
    }

    @GetMapping("/tracked-cryptos")
    public ResponseEntity<List<TrackedAssetDto>> listTrackedCryptos() {
        return ResponseEntity.ok(marketStatsService.getAllTrackedAssets());
    }

    @PostMapping("/tracked-cryptos")
    public ResponseEntity<TrackedAssetDto> addTrackedCrypto(@RequestBody AddTrackedCryptoRequest request) {
        TrackedAsset asset = adminTrackedCryptoService.addSymbol(request.symbol());
        return ResponseEntity.ok(TrackedAssetDto.from(asset));
    }

    @DeleteMapping("/tracked-cryptos/{symbol}")
    public ResponseEntity<Void> removeTrackedCrypto(@PathVariable String symbol) {
        adminTrackedCryptoService.removeSymbol(symbol);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sync/market-data")
    public ResponseEntity<Void> syncMarketData() {
        if (!historySyncInProgress.compareAndSet(false, true)) {
            return ResponseEntity.status(409).build();
        }
        CompletableFuture.runAsync(() -> {
            try {
                marketDataSyncService.syncAll();
            } finally {
                historySyncInProgress.set(false);
            }
        });
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/sync/market-stats")
    public ResponseEntity<Void> syncMarketStats() {
        if (!statsSyncInProgress.compareAndSet(false, true)) {
            return ResponseEntity.status(409).build();
        }
        CompletableFuture.runAsync(() -> {
            try {
                marketStatsSyncService.syncMarketStats();
            } finally {
                statsSyncInProgress.set(false);
            }
        });
        return ResponseEntity.accepted().build();
    }
}
