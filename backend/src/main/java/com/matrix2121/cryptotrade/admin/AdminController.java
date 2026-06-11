package com.matrix2121.cryptotrade.admin;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.admin.dto.AddTrackedCryptoRequest;
import com.matrix2121.cryptotrade.admin.dto.AdminUserDto;
import com.matrix2121.cryptotrade.admin.dto.SetAdminRequest;
import com.matrix2121.cryptotrade.marketdata.MarketDataSyncService;
import com.matrix2121.cryptotrade.marketstats.MarketStatsService;
import com.matrix2121.cryptotrade.marketstats.MarketStatsSyncService;
import com.matrix2121.cryptotrade.marketstats.dto.TrackedAssetDto;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.predictions.MlServiceClient;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final MarketStatsService marketStatsService;
    private final AdminUserService adminUserService;
    private final AdminTrackedCryptoService adminTrackedCryptoService;
    private final MarketDataSyncService marketDataSyncService;
    private final MarketStatsSyncService marketStatsSyncService;
    private final MlServiceClient mlServiceClient;
    private final AtomicBoolean statsSyncInProgress = new AtomicBoolean(false);
    private final AtomicBoolean hourlyPredictInProgress = new AtomicBoolean(false);
    private final AtomicBoolean dailyPredictInProgress = new AtomicBoolean(false);

    public AdminController(
            MarketStatsService marketStatsService,
            AdminUserService adminUserService,
            AdminTrackedCryptoService adminTrackedCryptoService,
            MarketDataSyncService marketDataSyncService,
            MarketStatsSyncService marketStatsSyncService,
            MlServiceClient mlServiceClient) {
        this.marketStatsService = marketStatsService;
        this.adminUserService = adminUserService;
        this.adminTrackedCryptoService = adminTrackedCryptoService;
        this.marketDataSyncService = marketDataSyncService;
        this.marketStatsSyncService = marketStatsSyncService;
        this.mlServiceClient = mlServiceClient;
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDto>> listUsers() {
        return ResponseEntity.ok(adminUserService.listUsers());
    }

    @PatchMapping("/users/{userId}/admin")
    public ResponseEntity<AdminUserDto> setUserAdmin(
            @PathVariable Long userId,
            @RequestBody SetAdminRequest request) {
        String actingEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(adminUserService.setAdmin(userId, request.isAdmin(), actingEmail));
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
        if (!marketDataSyncService.runSyncAsync("admin")) {
            return ResponseEntity.status(409).build();
        }
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

    @PostMapping("/predictions/hourly")
    public ResponseEntity<Void> triggerHourlyPredictions() {
        if (!hourlyPredictInProgress.compareAndSet(false, true)) {
            return ResponseEntity.status(409).build();
        }
        CompletableFuture.runAsync(() -> {
            try {
                mlServiceClient.triggerHourlyBatchPredict("admin");
            } finally {
                hourlyPredictInProgress.set(false);
            }
        });
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/predictions/daily")
    public ResponseEntity<Void> triggerDailyPredictions() {
        if (!dailyPredictInProgress.compareAndSet(false, true)) {
            return ResponseEntity.status(409).build();
        }
        CompletableFuture.runAsync(() -> {
            try {
                mlServiceClient.triggerDailyBatchPredict("admin");
            } finally {
                dailyPredictInProgress.set(false);
            }
        });
        return ResponseEntity.accepted().build();
    }
}
