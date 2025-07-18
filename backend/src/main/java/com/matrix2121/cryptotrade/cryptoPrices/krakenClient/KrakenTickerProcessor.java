package com.matrix2121.cryptotrade.cryptoPrices.krakenClient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.PriceTick;
import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.TickerFrame;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;

@Slf4j
@Service
public class KrakenTickerProcessor {
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
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
                PriceTick priceTick = CryptoModelsMapper.mapTickerFrameToPriceTick(tickerFrame);
                updateContext(priceTick);
                broadcastPriceTick(priceTick);
            }
        } catch (Exception e) {
           log.error("Error processing Kraken tick: " + e.getMessage());
        }
    }

    private boolean isTickerUpdate(JsonNode root) {
        return "ticker".equals(root.path("channel").asText()) && ("update".equals(root.path("type").asText()) || "snapshot".equals(root.path("type").asText()));
    }

    private void updateContext(PriceTick priceTick){
        CryptoPricesContext.setPrices(priceTick.symbol(), priceTick.bid(), priceTick.ask());
    }

    private void broadcastPriceTick(PriceTick priceTick) {
        String jsonPayload = null;
        try {
            jsonPayload = mapper.writeValueAsString(priceTick);
        } catch (JsonProcessingException e) {
            log.error("Error serializing PriceTick: {}", priceTick, e);
        }
        TextMessage message = new TextMessage(jsonPayload);
        broadcaster.broadcast(message);
    }
}