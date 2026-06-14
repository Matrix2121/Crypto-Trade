package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenOhlcClient;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenTradesClient;
import com.matrix2121.cryptotrade.marketdata.dto.OhlcDto;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1dRepository;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1m;
import com.matrix2121.cryptotrade.marketdata.persistence.Ohlc1mRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MarketDataSyncServiceTest {

    @Mock
    private Ohlc1mRepository ohlc1mRepository;
    @Mock
    private Ohlc1dRepository ohlc1dRepository;
    @Mock
    private LiveTickCacheService liveTickCacheService;
    @Mock
    private KrakenOhlcClient krakenOhlcClient;
    @Mock
    private KrakenTradesClient krakenTradesClient;
    @Mock
    private TrackedSymbolsService trackedSymbolsService;

    private MarketDataSyncService syncService;

    @BeforeEach
    void setUp() {
        syncService = new MarketDataSyncService(
                ohlc1mRepository,
                ohlc1dRepository,
                liveTickCacheService,
                krakenOhlcClient,
                krakenTradesClient,
                trackedSymbolsService,
                new OhlcGapDetector());
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD"));
        when(krakenTradesClient.fetchLastTrades(anyString())).thenReturn(List.of());
    }

    @Test
    void syncAll_skipsKrakenFetchWhenNoGaps() {
        long now = System.currentTimeMillis();
        when(ohlc1mRepository.findBucketEpochMsBetween(anyString(), anyLong(), anyLong()))
                .thenReturn(generateTimestamps(OhlcIntervalPolicy.windowStartMs("1m", now), now, 60_000L));

        when(ohlc1dRepository.findMinBucketBySymbol("BTC/USD"))
                .thenReturn(Instant.ofEpochMilli(now - 6L * 365 * 24 * 60 * 60 * 1000));
        when(ohlc1dRepository.findMaxBucketBySymbol("BTC/USD"))
                .thenReturn(Instant.ofEpochMilli(now));
        when(ohlc1dRepository.findBucketEpochMsBetween(anyString(), eq(now), anyLong()))
                .thenReturn(generateTimestamps(now, now, 24L * 60 * 60_000L));

        syncService.syncAll();

        verify(krakenOhlcClient, never()).fetchOhlcSince(anyString(), any(Integer.class), anyLong());
    }

    @Test
    void syncAll_insertsOnlyMissingCandles() {
        long now = System.currentTimeMillis();
        long windowStart = OhlcIntervalPolicy.windowStartMs("1m", now);
        long ts = alignDown(windowStart + 60_000L, 60_000L);

        when(ohlc1mRepository.findBucketEpochMsBetween(anyString(), anyLong(), anyLong()))
                .thenReturn(List.of(ts));

        OhlcDto missing = new OhlcDto(
                ts + 60_000L,
                BigDecimal.ONE,
                BigDecimal.valueOf(2),
                BigDecimal.ONE,
                BigDecimal.valueOf(2),
                BigDecimal.TEN);
        when(krakenOhlcClient.fetchOhlcSince(eq("BTC/USD"), eq(1), anyLong()))
                .thenReturn(List.of(missing));
        when(ohlc1mRepository.existsBySymbolAndBucket(eq("BTC/USD"), any(Instant.class)))
                .thenReturn(false);

        when(ohlc1dRepository.findMinBucketBySymbol("BTC/USD"))
                .thenReturn(Instant.ofEpochMilli(now - 6L * 365 * 24 * 60 * 60 * 1000));
        when(ohlc1dRepository.findMaxBucketBySymbol("BTC/USD"))
                .thenReturn(Instant.ofEpochMilli(now));
        when(ohlc1dRepository.findBucketEpochMsBetween(anyString(), eq(now), anyLong()))
                .thenReturn(generateTimestamps(now, now, 24L * 60 * 60_000L));

        syncService.syncAll();

        ArgumentCaptor<List<Ohlc1m>> captor = ArgumentCaptor.forClass(List.class);
        verify(ohlc1mRepository).saveAll(captor.capture());
        assertEquals(1, captor.getValue().size());
        assertEquals(missing.timestamp(), OhlcTimeConverter.toEpochMs(captor.getValue().get(0).getBucket()));
    }

    private static List<Long> generateTimestamps(long start, long end, long step) {
        ArrayList<Long> timestamps = new ArrayList<>();
        long alignedStart = alignDown(start, step);
        for (long t = alignedStart; t <= end; t += step) {
            timestamps.add(t);
        }
        return timestamps;
    }

    private static long alignDown(long timestampMs, long stepMs) {
        return Math.floorDiv(timestampMs, stepMs) * stepMs;
    }
}
