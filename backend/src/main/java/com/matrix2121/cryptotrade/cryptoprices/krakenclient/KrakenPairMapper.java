package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

public final class KrakenPairMapper {

    private KrakenPairMapper() {
    }

    public static String toKrakenPair(String symbol) {
        String[] parts = symbol.split("/");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid symbol format, expected BASE/QUOTE: " + symbol);
        }
        String base = "BTC".equals(parts[0]) ? "XBT" : parts[0];
        return base + parts[1];
    }
}
