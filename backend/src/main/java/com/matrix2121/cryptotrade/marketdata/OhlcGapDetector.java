package com.matrix2121.cryptotrade.marketdata;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Detects missing OHLC candle timestamps within a retention window.
 */
@Component
public class OhlcGapDetector {

    public record TimeRange(long startMs, long endMs) {
    }

    public List<TimeRange> findGaps(
            Set<Long> existingTimestamps,
            long windowStartMs,
            long windowEndMs,
            long stepMs) {

        if (windowEndMs <= windowStartMs || stepMs <= 0) {
            return List.of();
        }

        long alignedStart = alignDown(windowStartMs, stepMs);
        long alignedEnd = alignDown(windowEndMs, stepMs);
        if (alignedEnd < alignedStart) {
            return List.of();
        }

        List<TimeRange> gaps = new ArrayList<>();
        Long gapStart = null;
        long previousExpected = alignedStart - stepMs;

        for (long ts = alignedStart; ts <= alignedEnd; ts += stepMs) {
            if (existingTimestamps.contains(ts)) {
                if (gapStart != null) {
                    gaps.add(new TimeRange(gapStart, previousExpected));
                    gapStart = null;
                }
            } else if (gapStart == null) {
                gapStart = ts;
            }
            previousExpected = ts;
        }

        if (gapStart != null) {
            gaps.add(new TimeRange(gapStart, previousExpected));
        }

        return mergeAdjacentGaps(gaps, stepMs);
    }

    public List<TimeRange> mergeAdjacentGaps(List<TimeRange> gaps, long stepMs) {
        if (gaps.isEmpty()) {
            return List.of();
        }

        List<TimeRange> merged = new ArrayList<>();
        TimeRange current = gaps.get(0);

        for (int i = 1; i < gaps.size(); i++) {
            TimeRange next = gaps.get(i);
            if (next.startMs() <= current.endMs() + stepMs) {
                current = new TimeRange(current.startMs(), Math.max(current.endMs(), next.endMs()));
            } else {
                merged.add(current);
                current = next;
            }
        }
        merged.add(current);
        return merged;
    }

    public Set<Long> toTimestampSet(List<Long> timestamps) {
        return new HashSet<>(timestamps);
    }

    private static long alignDown(long timestampMs, long stepMs) {
        return Math.floorDiv(timestampMs, stepMs) * stepMs;
    }
}
