package com.matrix2121.cryptotrade.marketdata;

import java.time.Instant;

public final class OhlcTimeConverter {

    private OhlcTimeConverter() {
    }

    public static Instant toInstant(long epochMs) {
        return Instant.ofEpochMilli(epochMs);
    }

    public static long toEpochMs(Instant instant) {
        return instant.toEpochMilli();
    }
}
