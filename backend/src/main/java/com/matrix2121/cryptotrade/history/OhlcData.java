package com.matrix2121.cryptotrade.history;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "ohlc_data",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ohlc_symbol_interval_timestamp",
                columnNames = { "symbol", "interval_string", "timestamp" }),
        indexes = {
                @Index(name = "idx_ohlc_symbol", columnList = "symbol"),
                @Index(name = "idx_ohlc_interval_string", columnList = "interval_string"),
                @Index(name = "idx_ohlc_timestamp", columnList = "timestamp"),
                @Index(name = "idx_ohlc_symbol_interval", columnList = "symbol, interval_string")
        })
public class OhlcData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(name = "interval_string", nullable = false, length = 8)
    private String intervalString;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal open;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal high;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal low;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal close;

    protected OhlcData() {
    }

    public OhlcData(
            String symbol,
            String intervalString,
            Long timestamp,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close) {
        this.symbol = symbol;
        this.intervalString = intervalString;
        this.timestamp = timestamp;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
    }

    public Long getId() {
        return id;
    }

    public String getSymbol() {
        return symbol;
    }

    public String getIntervalString() {
        return intervalString;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public BigDecimal getOpen() {
        return open;
    }

    public BigDecimal getHigh() {
        return high;
    }

    public BigDecimal getLow() {
        return low;
    }

    public BigDecimal getClose() {
        return close;
    }
}
