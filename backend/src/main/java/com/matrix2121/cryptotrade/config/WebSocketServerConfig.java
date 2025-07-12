package com.matrix2121.cryptotrade.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.*;

import com.matrix2121.cryptotrade.cryptoPrices.broadcaster.BroadcasterImpl;

@Configuration
@EnableWebSocket
public class WebSocketServerConfig implements WebSocketConfigurer {
    private final BroadcasterImpl handler;

    public WebSocketServerConfig(BroadcasterImpl handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry
            .addHandler(handler, "/ws")
            .setAllowedOriginPatterns("*");
    }
}