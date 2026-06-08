package com.matrix2121.cryptotrade.marketdata;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class MarketDataBackfillTest {

    @Autowired
    private MarketDataSyncService marketDataSyncService;

    @Test
    void syncAllMarketData() {
        marketDataSyncService.syncAll();
    }
}
