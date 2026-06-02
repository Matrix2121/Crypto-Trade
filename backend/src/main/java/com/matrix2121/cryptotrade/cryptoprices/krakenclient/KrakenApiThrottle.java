package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import org.springframework.stereotype.Component;

/**
 * Serializes Kraken REST calls so bulk OHLC backfill stays under public rate
 * limits.
 */
@Component
public class KrakenApiThrottle {

    private static final long MIN_INTERVAL_MS = 1_500L;
    private static final long MAX_BACKOFF_MS = 30_000L;

    private long lastRequestMs = 0;

    public synchronized void awaitSlot() {
        long now = System.currentTimeMillis();
        long wait = MIN_INTERVAL_MS - (now - lastRequestMs);
        if (wait > 0) {
            sleep(wait);
        }
        lastRequestMs = System.currentTimeMillis();
    }

    public void awaitRateLimitBackoff(int attempt) {
        long backoff = Math.min(MAX_BACKOFF_MS, 2_000L * (1L << Math.min(attempt - 1, 4)));
        sleep(backoff);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
