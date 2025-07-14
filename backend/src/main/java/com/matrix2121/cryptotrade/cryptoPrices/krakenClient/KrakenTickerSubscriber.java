package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import lombok.extern.slf4j.Slf4j;

import java.net.http.WebSocket;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

@Slf4j
@Service
public class KrakenTickerSubscriber {
    private final String[] SYMBOLS = {
        "BTC/USD", "ETH/USD", "XRP/USD", "USDT/USD", "BNB/USD",
        "SOL/USD", "USDC/USD", "DOGE/USD", "TRX/USD", "ADA/USD",
        "WBTC/USD", "XLM/USD", "SUI/USD", "LINK/USD", "HBAR/USD",
        "BCH/USD", "AVAX/USD", "SHIB/USD", "TON/USD", "LTC/USD"
    };
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public void subscribe(WebSocket webSocket) {
        var subscription = Map.of(
            "method", "subscribe",
            "params", Map.of("channel", "ticker", "symbol", List.of(SYMBOLS))
        );
        try {
            webSocket.sendText(mapper.writeValueAsString(subscription), true);
        } catch (JsonProcessingException e) {
            log.error("Error parsing: " + e.getMessage());
        }
    }
}