package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;

import com.matrix2121.cryptotrade.cryptoprices.broadcaster.BroadcasterImpl;

@Service
public class KrakenTickBroadcaster {
    private final BroadcasterImpl broadcaster;

    public KrakenTickBroadcaster(BroadcasterImpl broadcaster) {
        this.broadcaster = broadcaster;
    }

    public void broadcast(TextMessage message) {
        broadcaster.broadcast(message);
    }
}