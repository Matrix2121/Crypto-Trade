package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1dRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1mRepository;

@ExtendWith(MockitoExtension.class)
class MarketDataFreshnessServiceTest {

    private static final long MS_PER_HOUR = 60L * 60 * 1_000L;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;
    private static final long NOW = 1_700_000_000_000L;

    @Mock
    private Ohlc1mRepository ohlc1mRepository;

    @Mock
    private Ohlc1dRepository ohlc1dRepository;

    @Mock
    private TrackedSymbolsService trackedSymbolsService;

    private MarketDataFreshnessService freshnessService;

    @BeforeEach
    void setUp() {
        freshnessService = new MarketDataFreshnessService(
                ohlc1mRepository, ohlc1dRepository, trackedSymbolsService);
    }

    @Test
    void checkAll_reportsStaleWhenDailyIntervalMissing() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD"));
        stub1m("BTC/USD", NOW - MS_PER_HOUR);
        when(ohlc1dRepository.findMaxBucketBySymbol("BTC/USD")).thenReturn(null);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertTrue(report.isAnyStale());
        assertEquals(1, report.staleSymbols().size());
        assertEquals("1d", report.staleSymbols().get(0).staleIntervals().get(0).intervalString());
        assertEquals(null, report.staleSymbols().get(0).staleIntervals().get(0).lastTimestampMs());
    }

    @Test
    void checkAll_reportsStaleWhenDailyIntervalTooOld() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD"));
        long staleDaily = NOW - (3L * MS_PER_DAY);
        stub1d("BTC/USD", staleDaily);
        stub1m("BTC/USD", NOW - MS_PER_HOUR);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertTrue(report.isAnyStale());
        assertEquals(1, report.staleSymbols().size());
        MarketDataFreshnessService.StaleInterval stale =
                report.staleSymbols().get(0).staleIntervals().get(0);
        assertEquals("1d", stale.intervalString());
        assertEquals(staleDaily, stale.lastTimestampMs());
    }

    @Test
    void checkAll_reportsFreshWhenAllIntervalsCurrent() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD", "ETH/USD"));
        stubFresh("BTC/USD", NOW - MS_PER_HOUR);
        stubFresh("ETH/USD", NOW - MS_PER_HOUR);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertFalse(report.isAnyStale());
        assertEquals(2, report.totalSymbols());
        assertTrue(report.staleSymbols().isEmpty());
    }

    @Test
    void checkAll_reportsOnlyStaleSymbols() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD", "ETH/USD"));
        stubFresh("BTC/USD", NOW - MS_PER_HOUR);
        stub1d("ETH/USD", NOW - (3L * MS_PER_DAY));
        stub1m("ETH/USD", NOW - MS_PER_HOUR);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertTrue(report.isAnyStale());
        assertEquals(1, report.staleSymbols().size());
        assertEquals("ETH/USD", report.staleSymbols().get(0).symbol());
    }

    private void stubFresh(String symbol, long timestamp) {
        stub1m(symbol, timestamp);
        stub1d(symbol, timestamp);
    }

    private void stub1m(String symbol, long timestamp) {
        when(ohlc1mRepository.findMaxBucketBySymbol(eq(symbol)))
                .thenReturn(Instant.ofEpochMilli(timestamp));
    }

    private void stub1d(String symbol, long timestamp) {
        when(ohlc1dRepository.findMaxBucketBySymbol(eq(symbol)))
                .thenReturn(Instant.ofEpochMilli(timestamp));
    }
}
