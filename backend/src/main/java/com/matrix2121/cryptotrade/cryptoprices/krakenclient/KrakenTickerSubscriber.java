package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import lombok.extern.slf4j.Slf4j;

import java.net.http.WebSocket;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;

@Slf4j
@Service
public class KrakenTickerSubscriber {
    private final TrackedSymbolsService trackedSymbolsService;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public KrakenTickerSubscriber(TrackedSymbolsService trackedSymbolsService) {
        this.trackedSymbolsService = trackedSymbolsService;
    }

    public void subscribe(WebSocket webSocket) {
        List<String> symbols = trackedSymbolsService.getSymbols();
        var subscription = Map.of(
                "method", "subscribe",
                "params", Map.of("channel", "ticker", "symbol", symbols));
        try {
            webSocket.sendText(mapper.writeValueAsString(subscription), true);
        } catch (JsonProcessingException e) {
            log.error("Error parsing: " + e.getMessage());
        }
    }
}