package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class KrakenWebSocketConnection implements Listener {

    private static final String KRAKEN_WS_URI = "wss://ws.kraken.com/v2";
    private static final long MAX_BACKOFF_MS = 60_000L;
    private static final long WATCHDOG_INTERVAL_SEC = 60L;
    private static final long STALE_TICK_THRESHOLD_MS = 3 * 60 * 1_000L;

    private final KrakenTickerSubscriber subscriber;
    private final KrakenTickerProcessor processor;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "kraken-ws");
                t.setDaemon(true);
                return t;
            });
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private final AtomicBoolean reconnectScheduled = new AtomicBoolean(false);
    private final AtomicInteger reconnectAttempt = new AtomicInteger(0);

    private volatile WebSocket activeSocket;

    public KrakenWebSocketConnection(KrakenTickerSubscriber subscriber, KrakenTickerProcessor processor) {
        this.subscriber = subscriber;
        this.processor = processor;
    }

    @PostConstruct
    public void initialize() {
        connect();
        scheduler.scheduleAtFixedRate(
                this::runWatchdog,
                WATCHDOG_INTERVAL_SEC,
                WATCHDOG_INTERVAL_SEC,
                TimeUnit.SECONDS);
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
        WebSocket ws = activeSocket;
        if (ws != null) {
            ws.sendClose(WebSocket.NORMAL_CLOSURE, "shutdown");
        }
    }

    private void connect() {
        if (!connecting.compareAndSet(false, true)) {
            return;
        }
        reconnectScheduled.set(false);

        httpClient.newWebSocketBuilder()
                .buildAsync(URI.create(KRAKEN_WS_URI), this)
                .whenComplete((ws, err) -> {
                    connecting.set(false);
                    if (err != null) {
                        log.warn("Kraken WebSocket connect failed: {}", err.getMessage());
                        scheduleReconnect();
                    }
                });
    }

    private void scheduleReconnect() {
        if (!reconnectScheduled.compareAndSet(false, true)) {
            return;
        }

        int attempt = reconnectAttempt.incrementAndGet();
        long delayMs = Math.min(MAX_BACKOFF_MS, 1_000L * (1L << Math.min(attempt - 1, 6)));
        log.info("Scheduling Kraken reconnect in {} ms (attempt {})", delayMs, attempt);

        scheduler.schedule(() -> {
            reconnectScheduled.set(false);
            connect();
        }, delayMs, TimeUnit.MILLISECONDS);
    }

    private void runWatchdog() {
        long lastTickMs = CryptoPricesContext.getLastAnyTickEpochMs();
        if (lastTickMs <= 0) {
            return;
        }

        long staleMs = System.currentTimeMillis() - lastTickMs;
        if (staleMs < STALE_TICK_THRESHOLD_MS) {
            return;
        }

        log.warn("No Kraken ticks for {} ms — forcing reconnect", staleMs);
        forceReconnect();
    }

    private void forceReconnect() {
        WebSocket ws = activeSocket;
        activeSocket = null;
        if (ws != null) {
            ws.sendClose(WebSocket.NORMAL_CLOSURE, "stale feed");
            return;
        }
        scheduleReconnect();
    }

    @Override
    public void onOpen(WebSocket webSocket) {
        reconnectAttempt.set(0);
        activeSocket = webSocket;
        subscriber.subscribe(webSocket);
        Listener.super.onOpen(webSocket);
        log.info("Kraken WebSocket connected");
    }

    @Override
    public void onError(WebSocket ws, Throwable err) {
        log.warn("Kraken WebSocket error: {}", err.getMessage());
        scheduleReconnect();
    }

    @Override
    public CompletionStage<?> onClose(WebSocket ws, int status, String reason) {
        if (activeSocket == ws) {
            activeSocket = null;
        }
        log.warn("Kraken WebSocket closed: status={} reason={}", status, reason);
        scheduleReconnect();
        return Listener.super.onClose(ws, status, reason);
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        processor.process(data);
        return Listener.super.onText(webSocket, data, last);
    }
}
