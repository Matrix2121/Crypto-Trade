package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.PriceTick;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.TickerFrame;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;

@Service
public class KrakenTickerProcessor {
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final KrakenTickBroadcaster broadcaster;

    public KrakenTickerProcessor(KrakenTickBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    public void process(CharSequence data) {
        try {
            JsonNode root = mapper.readTree(data.toString());
            if (isTickerUpdate(root)) {
                JsonNode tickerData = root.withArray("data").get(0);
                TickerFrame tickerFrame = mapper.treeToValue(tickerData, TickerFrame.class);
                PriceTick priceTick = mapToPriceTick(tickerFrame);
                broadcastPriceTick(priceTick);
            }
        } catch (Exception e) {
            // Exception handling deferred; do nothing for now
        }
    }

    private boolean isTickerUpdate(JsonNode root) {
        return "ticker".equals(root.path("channel").asText()) && "update".equals(root.path("type").asText());
    }

    private PriceTick mapToPriceTick(TickerFrame tickerFrame) {
        return CryptoModelsMapper.mapTickerFrameToPriceTick(tickerFrame);
    }

    private void broadcastPriceTick(PriceTick priceTick) {
        String jsonPayload = null;
        try {
            jsonPayload = mapper.writeValueAsString(priceTick);
        } catch (JsonProcessingException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
        TextMessage message = new TextMessage(jsonPayload);
        broadcaster.broadcast(message);
    }
}