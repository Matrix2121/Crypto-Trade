package com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TickerFrame(
        String symbol,
        String ask,
        String bid) {
}
