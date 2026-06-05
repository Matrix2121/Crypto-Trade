package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.util.concurrent.CompletionStage;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class KrakenWebSocketConnection implements Listener {

    private static final String KRAKEN_WS_URI = "wss://ws.kraken.com/v2";

    private final KrakenTickerSubscriber subscriber;
    private final KrakenTickerProcessor processor;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public KrakenWebSocketConnection(KrakenTickerSubscriber subscriber, KrakenTickerProcessor processor) {
        this.subscriber = subscriber;
        this.processor = processor;
    }

    @PostConstruct
    public void initialize() {
        httpClient.newWebSocketBuilder()
                .buildAsync(URI.create(KRAKEN_WS_URI), this);
    }

    @Override
    public void onOpen(WebSocket webSocket) {
        subscriber.subscribe(webSocket);
        //
        Listener.super.onOpen(webSocket);
    }

    @Override
    public void onError(WebSocket ws, Throwable err) {
        // Kraken may close idle connections; the next app restart or reconnect policy
        // handles recovery.
        log.warn("Kraken WebSocket error: {}", err.getMessage());
    }

    @Override
    public CompletionStage<?> onClose(WebSocket ws, int status, String reason) {
        return Listener.super.onClose(ws, status, reason);
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        processor.process(data);
        return Listener.super.onText(webSocket, data, last);
    }
}
