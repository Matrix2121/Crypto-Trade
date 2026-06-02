package com.matrix2121.cryptotrade.history;

import java.util.List;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenOhlcClient;
import com.matrix2121.cryptotrade.cryptoprices.krakenclient.KrakenTradesClient;

@Service
public class ChartHistoryService {

    private final KrakenTradesClient krakenTradesClient;
    private final KrakenOhlcClient krakenOhlcClient;

    public ChartHistoryService(KrakenTradesClient krakenTradesClient, KrakenOhlcClient krakenOhlcClient) {
        this.krakenTradesClient = krakenTradesClient;
        this.krakenOhlcClient = krakenOhlcClient;
    }

    public List<TickDto> getTicks(String symbol, int minutes) {
        return krakenTradesClient.fetchRecentTrades(symbol, minutes);
    }

    public List<OhlcDto> getOhlc(String symbol, int interval) {
        return krakenOhlcClient.fetchOhlc(symbol, interval);
    }
}
