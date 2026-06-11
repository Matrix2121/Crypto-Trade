package com.matrix2121.cryptotrade.marketdata.persistence;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "ohlc_1d")
@IdClass(OhlcBucketId.class)
public class Ohlc1d {

    @Id
    @Column(nullable = false, length = 32)
    private String symbol;

    @Id
    @Column(nullable = false)
    private Instant bucket;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal open;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal high;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal low;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal close;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal volume = BigDecimal.ZERO;

    protected Ohlc1d() {
    }

    public Ohlc1d(
            String symbol,
            Instant bucket,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            BigDecimal volume) {
        this.symbol = symbol;
        this.bucket = bucket;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.volume = volume != null ? volume : BigDecimal.ZERO;
    }

    public String getSymbol() {
        return symbol;
    }

    public Instant getBucket() {
        return bucket;
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

    public BigDecimal getVolume() {
        return volume;
    }
}
