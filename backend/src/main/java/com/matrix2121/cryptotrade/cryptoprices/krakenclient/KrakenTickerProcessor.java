package com.matrix2121.cryptotrade.cryptoprices.krakenclient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.CompletableFuture;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.model.PriceTick;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.model.TickerFrame;
import com.matrix2121.cryptotrade.marketdata.LiveTickCacheService;
import com.matrix2121.cryptotrade.marketdata.dto.TickDto;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class KrakenTickerProcessor {

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final KrakenTickBroadcaster broadcaster;
    private final LiveTickCacheService liveTickCacheService;
    private final TrackedAssetRepository trackedAssetRepository;

    public KrakenTickerProcessor(
            KrakenTickBroadcaster broadcaster,
            LiveTickCacheService liveTickCacheService,
            TrackedAssetRepository trackedAssetRepository) {
        this.broadcaster = broadcaster;
        this.liveTickCacheService = liveTickCacheService;
        this.trackedAssetRepository = trackedAssetRepository;
    }

    public void process(CharSequence data) {
        try {
            JsonNode root = mapper.readTree(data.toString());
            if (isTickerUpdate(root)) {
                handleTickerUpdate(root);
            }
        } catch (Exception e) {
            log.error("Error processing Kraken tick: {}", e.getMessage());
        }
    }

    private void handleTickerUpdate(JsonNode root) throws JsonProcessingException {
        JsonNode dataArray = root.withArray("data");
        if (dataArray.isEmpty()) {
            return;
        }

        JsonNode tickerNode = dataArray.get(0);
        TickerFrame tickerFrame = mapper.treeToValue(tickerNode, TickerFrame.class);
        PriceTick priceTick = CryptoModelsMapper.mapTickerFrameToPriceTick(tickerFrame);
        updateContext(priceTick);
        ingestLiveTick(priceTick);
        broadcastPriceTick(priceTick);
    }

    private boolean isTickerUpdate(JsonNode root) {
        return "ticker".equals(root.path("channel").asText())
                && ("update".equals(root.path("type").asText()));
    }

    private void updateContext(PriceTick priceTick) {
        CryptoPricesContext.setPrices(priceTick.symbol(), priceTick.bid(), priceTick.ask());
    }

    /**
     * Feeds the live tick into the in-memory cache and schedules an async ATH
     * check.
     * No database write happens here.
     */
    private void ingestLiveTick(PriceTick priceTick) {
        BigDecimal mid = priceTick.bid()
                .add(priceTick.ask())
                .divide(BigDecimal.valueOf(2), 8, RoundingMode.HALF_UP);
        long timestampMs = priceTick.timestamp().toEpochMilli();

        TickDto tickDto = new TickDto(timestampMs, mid, priceTick.bid(),
                priceTick.ask());
        liveTickCacheService.addLiveTick(priceTick.symbol(), tickDto);

        CompletableFuture.runAsync(() -> checkAndUpdateAth(priceTick.symbol(), mid));
    }

    private void checkAndUpdateAth(String symbol, BigDecimal price) {
        try {
            trackedAssetRepository.findById(symbol).ifPresent(asset -> {
                if (asset.getAllTimeHigh() == null
                        || price.compareTo(asset.getAllTimeHigh()) > 0) {
                    asset.setAllTimeHigh(price);
                    asset.setAthTimestamp(System.currentTimeMillis());
                    trackedAssetRepository.save(asset);
                    log.info("New ATH for {}: {}", symbol, price);
                }
            });
        } catch (Exception e) {
            log.error("ATH update failed for {}: {}", symbol, e.getMessage());
        }
    }

    private PriceTick enrichWithPrevious(PriceTick priceTick) {
        return new PriceTick(
                priceTick.symbol(),
                priceTick.ask(),
                priceTick.bid(),
                CryptoPricesContext.getPreviousAsk(priceTick.symbol()),
                CryptoPricesContext.getPreviousBid(priceTick.symbol()),
                priceTick.timestamp());
    }

    private void broadcastPriceTick(PriceTick priceTick) {
        PriceTick payload = enrichWithPrevious(priceTick);
        try {
            String jsonPayload = mapper.writeValueAsString(payload);
            broadcaster.broadcast(new TextMessage(jsonPayload));
        } catch (JsonProcessingException e) {
            log.error("Error serializing PriceTick: {}", payload, e);
        }
    }
}
