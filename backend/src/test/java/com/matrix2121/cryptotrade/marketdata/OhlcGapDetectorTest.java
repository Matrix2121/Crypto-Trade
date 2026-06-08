package com.matrix2121.cryptotrade.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OhlcGapDetectorTest {

    private OhlcGapDetector detector;

    @BeforeEach
    void setUp() {
        detector = new OhlcGapDetector();
    }

    @Test
    void findGaps_emptyDb_returnsFullWindow() {
        long step = 60_000L;
        long start = 0L;
        long end = 3 * step;

        List<OhlcGapDetector.TimeRange> gaps = detector.findGaps(Set.of(), start, end, step);

        assertEquals(1, gaps.size());
        assertEquals(0L, gaps.get(0).startMs());
        assertEquals(3 * step, gaps.get(0).endMs());
    }

    @Test
    void findGaps_noGaps_returnsEmpty() {
        long step = 60_000L;
        Set<Long> existing = Set.of(0L, step, 2 * step);

        List<OhlcGapDetector.TimeRange> gaps = detector.findGaps(existing, 0L, 2 * step, step);

        assertTrue(gaps.isEmpty());
    }

    @Test
    void findGaps_singleMissingSlot() {
        long step = 60_000L;
        Set<Long> existing = Set.of(0L, 2 * step);

        List<OhlcGapDetector.TimeRange> gaps = detector.findGaps(existing, 0L, 2 * step, step);

        assertEquals(1, gaps.size());
        assertEquals(step, gaps.get(0).startMs());
        assertEquals(step, gaps.get(0).endMs());
    }

    @Test
    void findGaps_multipleGaps_mergesAdjacentIntoRanges() {
        long step = 60_000L;
        Set<Long> existing = Set.of(0L, 4 * step);

        List<OhlcGapDetector.TimeRange> gaps = detector.findGaps(existing, 0L, 4 * step, step);

        assertEquals(1, gaps.size());
        assertEquals(step, gaps.get(0).startMs());
        assertEquals(3 * step, gaps.get(0).endMs());
    }

    @Test
    void mergeAdjacentGaps_combinesTouchingRanges() {
        long step = 60_000L;
        List<OhlcGapDetector.TimeRange> gaps = List.of(
                new OhlcGapDetector.TimeRange(60_000L, 120_000L),
                new OhlcGapDetector.TimeRange(180_000L, 240_000L));

        List<OhlcGapDetector.TimeRange> merged = detector.mergeAdjacentGaps(gaps, step);

        assertEquals(1, merged.size());
        assertEquals(60_000L, merged.get(0).startMs());
        assertEquals(240_000L, merged.get(0).endMs());
    }
}
