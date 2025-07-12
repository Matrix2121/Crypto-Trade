package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.util.concurrent.CompletionStage;

import org.springframework.stereotype.Service;

@Service
public class KrakenWebSocketConnection implements Listener {
    private final String WS_URI = "wss://ws.kraken.com/v2";
    private final KrakenTickerSubscriber subscriber;
    private final KrakenTickerProcessor processor;
    private WebSocket webSocket;

    public KrakenWebSocketConnection(KrakenTickerSubscriber subscriber, KrakenTickerProcessor processor) {
        this.subscriber = subscriber;
        this.processor = processor;
    }

    @PostConstruct
    public void initialize() {
        HttpClient.newHttpClient()
                .newWebSocketBuilder()
                .buildAsync(URI.create(WS_URI), this)
                .thenAccept(webSocket -> this.webSocket = webSocket);
    }

    @Override
    public void onOpen(WebSocket webSocket) {
        this.webSocket = webSocket;
        subscriber.subscribe(webSocket);
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
        processor.process(data);
        return Listener.super.onText(webSocket, data, last);
    }
}