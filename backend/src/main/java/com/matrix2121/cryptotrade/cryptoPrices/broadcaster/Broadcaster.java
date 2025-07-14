package com.matrix2121.cryptotrade.cryptoPrices.broadcaster;

import org.springframework.web.socket.TextMessage;

public interface Broadcaster {
    void broadcast(TextMessage message);
}