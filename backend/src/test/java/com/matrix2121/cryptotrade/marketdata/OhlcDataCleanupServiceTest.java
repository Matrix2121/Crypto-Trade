package com.matrix2121.cryptotrade.marketdata;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.matrix2121.cryptotrade.marketdata.persistence.OhlcDataRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OhlcDataCleanupServiceTest {

    @Mock
    private OhlcDataRepository ohlcDataRepository;

    @Mock
    private TrackedSymbolsService trackedSymbolsService;

    private OhlcDataCleanupService cleanupService;

    @BeforeEach
    void setUp() {
        cleanupService = new OhlcDataCleanupService(ohlcDataRepository, trackedSymbolsService);
        when(trackedSymbolsService.getSymbols()).thenReturn(List.of("BTC/USD"));
        when(ohlcDataRepository.deleteBySymbolAndIntervalStringAndTimestampLessThan(
                anyString(), anyString(), anyLong())).thenReturn(0L);
    }

    @Test
    void runCleanup_neverDeletesUnlimitedIntervals() {
        cleanupService.runCleanup();

        verify(ohlcDataRepository, never()).deleteBySymbolAndIntervalStringAndTimestampLessThan(
                eq("BTC/USD"), eq("1h"), anyLong());
        verify(ohlcDataRepository, never()).deleteBySymbolAndIntervalStringAndTimestampLessThan(
                eq("BTC/USD"), eq("1d"), anyLong());
        verify(ohlcDataRepository, never()).deleteBySymbolAndIntervalStringAndTimestampLessThan(
                eq("BTC/USD"), eq("1mo"), anyLong());
    }

    @Test
    void runCleanup_invokesDeleteForBoundedIntervalsOnly() {
        cleanupService.runCleanup();

        verify(ohlcDataRepository).deleteBySymbolAndIntervalStringAndTimestampLessThan(
                eq("BTC/USD"), eq("1m"), anyLong());
        verify(ohlcDataRepository, never()).deleteBySymbolAndIntervalStringAndTimestampLessThan(
                eq("BTC/USD"), eq("1h"), anyLong());
    }
}
