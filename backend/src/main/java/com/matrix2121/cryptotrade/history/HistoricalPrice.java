package com.matrix2121.cryptotrade.history;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "historical_price",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_historical_price_symbol_timeframe_timestamp",
                columnNames = { "symbol", "timeframe", "candle_timestamp" }))
public class HistoricalPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false)
    private Integer timeframe;

    @Column(name = "candle_timestamp", nullable = false)
    private Long timestamp;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal openPrice;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal highPrice;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal lowPrice;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal closePrice;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal volume;

    protected HistoricalPrice() {
    }

    public HistoricalPrice(
            String symbol,
            Integer timeframe,
            Long timestamp,
            BigDecimal openPrice,
            BigDecimal highPrice,
            BigDecimal lowPrice,
            BigDecimal closePrice,
            BigDecimal volume) {
        this.symbol = symbol;
        this.timeframe = timeframe;
        this.timestamp = timestamp;
        this.openPrice = openPrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.closePrice = closePrice;
        this.volume = volume;
    }

    public Long getId() {
        return id;
    }

    public String getSymbol() {
        return symbol;
    }

    public Integer getTimeframe() {
        return timeframe;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public BigDecimal getOpenPrice() {
        return openPrice;
    }

    public BigDecimal getHighPrice() {
        return highPrice;
    }

    public BigDecimal getLowPrice() {
        return lowPrice;
    }

    public BigDecimal getClosePrice() {
        return closePrice;
    }

    public BigDecimal getVolume() {
        return volume;
    }
}
