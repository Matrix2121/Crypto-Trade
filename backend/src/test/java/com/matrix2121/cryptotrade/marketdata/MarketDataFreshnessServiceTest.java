package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

@ExtendWith(MockitoExtension.class)
class MarketDataFreshnessServiceTest {

    private static final long MS_PER_HOUR = 60L * 60 * 1_000L;
    private static final long MS_PER_DAY = 24L * MS_PER_HOUR;
    private static final long NOW = 1_700_000_000_000L;

    @Mock
    private OhlcDataRepository ohlcDataRepository;

    @Mock
    private TrackedSymbolsService trackedSymbolsService;

    private MarketDataFreshnessService freshnessService;

    @BeforeEach
    void setUp() {
        freshnessService = new MarketDataFreshnessService(ohlcDataRepository, trackedSymbolsService);
    }

    @Test
    void checkAll_reportsStaleWhenDailyIntervalMissing() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD"));
        stubFreshTimestamps("BTC/USD", NOW - MS_PER_HOUR);
        when(ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString("BTC/USD", "1d"))
                .thenReturn(null);

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
        stubInterval("BTC/USD", "1d", staleDaily);
        stubFreshTimestampsExcept("BTC/USD", "1d", NOW - MS_PER_HOUR);

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
        stubFreshTimestamps("BTC/USD", NOW - MS_PER_HOUR);
        stubFreshTimestamps("ETH/USD", NOW - MS_PER_HOUR);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertFalse(report.isAnyStale());
        assertEquals(2, report.totalSymbols());
        assertTrue(report.staleSymbols().isEmpty());
    }

    @Test
    void checkAll_reportsOnlyStaleSymbols() {
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD", "ETH/USD"));
        stubFreshTimestamps("BTC/USD", NOW - MS_PER_HOUR);
        stubInterval("ETH/USD", "1d", NOW - (3L * MS_PER_DAY));
        stubFreshTimestampsExcept("ETH/USD", "1d", NOW - MS_PER_HOUR);

        MarketDataFreshnessService.FreshnessReport report = freshnessService.checkAll(NOW);

        assertTrue(report.isAnyStale());
        assertEquals(1, report.staleSymbols().size());
        assertEquals("ETH/USD", report.staleSymbols().get(0).symbol());
    }

    private void stubFreshTimestamps(String symbol, long timestamp) {
        for (String interval : List.of("1h", "2h", "8h", "1d", "5d", "1mo")) {
            stubInterval(symbol, interval, timestamp);
        }
    }

    private void stubFreshTimestampsExcept(String symbol, String exceptInterval, long timestamp) {
        for (String interval : List.of("1h", "2h", "8h", "1d", "5d", "1mo")) {
            if (!interval.equals(exceptInterval)) {
                stubInterval(symbol, interval, timestamp);
            }
        }
    }

    private void stubInterval(String symbol, String interval, Long timestamp) {
        when(ohlcDataRepository.findMaxTimestampBySymbolAndIntervalString(eq(symbol), eq(interval)))
                .thenReturn(timestamp);
    }
}
