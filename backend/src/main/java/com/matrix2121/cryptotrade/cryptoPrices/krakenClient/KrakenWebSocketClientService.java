package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.matrix2121.cryptotrade.cryptoPrices.broadcaster.PricePublisher;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.*;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionStage;

@Service
public class KrakenWebSocketClientService implements WebSocket.Listener {
    private final String WS_URI = "wss://ws.kraken.com/v2";
    private final List<String> SYMBOLS = List.of(
            "BTC/USD", "ETH/USD", "XRP/USD", "USDT/USD", "BNB/USD",
            "SOL/USD", "USDC/USD", "DOGE/USD", "TRX/USD", "ADA/USD",
            "HYPE/USD", "SUI/USD", "XLM/USD", "LINK/USD", "BCH/USD",
            "AVAX/USD", "HBAR/USD", "LEO/USD", "AHIB/USD", "TON/USD");

    private final ObjectMapper mapper = new ObjectMapper();

    @PostConstruct
    public void start() {
        HttpClient.newHttpClient()
                .newWebSocketBuilder()
                .buildAsync(URI.create(WS_URI), this)
                .exceptionally(err -> {
                    err.printStackTrace();
                    return null;
                });
    }
    
    @Override
    public void onOpen(WebSocket webSocket) {
        subscribeTicker(webSocket);
        Listener.super.onOpen(webSocket);
    }

    @Override
    public void onError(WebSocket ws, Throwable err) {

    }

    @Override
    public CompletionStage<?> onClose(WebSocket ws, int status, String reason) {
        return Listener.super.onClose(ws, status, reason);
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        handleText(data);
        return Listener.super.onText(webSocket, data, last);
    }

    private void subscribeTicker(WebSocket webSocket) {
        try {
            String msg = mapper.writeValueAsString(Map.of(
                    "method", "subscribe",
                    "params", Map.of(
                            "channel", "ticker",
                            "symbol", SYMBOLS)));
            webSocket.sendText(msg, true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleText(CharSequence data) {
        String json = data.toString();
        try {
            JsonNode root = mapper.readTree(json);

            if (!"ticker".equals(root.path("channel").asText())) return;
            if (!"update".equals(root.path("type").asText())) return;

            JsonNode jsonData = root.withArray("data").get(0);
            TickerFrame tickerFrame = mapper.treeToValue(jsonData, TickerFrame.class);

            PriceTick priceTick = new PriceTick(
                    tickerFrame.symbol(),
                    new BigDecimal(tickerFrame.ask()),
                    new BigDecimal(tickerFrame.bid()),
                    new BigDecimal(tickerFrame.last()),
                    Instant.now());

            //publish priceTick to broadcaster
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    

}
