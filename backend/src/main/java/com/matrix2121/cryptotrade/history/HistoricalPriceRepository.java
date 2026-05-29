package com.matrix2121.cryptotrade.history;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HistoricalPriceRepository extends JpaRepository<HistoricalPrice, Long> {

    List<HistoricalPrice> findBySymbolAndTimeframeOrderByTimestampAsc(String symbol, Integer timeframe);
}
