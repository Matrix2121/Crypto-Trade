package com.matrix2121.cryptotrade.marketstats.persistence;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Persistent snapshot of market metadata for each tracked symbol.
 * Updated during sync and used to avoid repeated CoinGecko calls.
 */
@Entity
@Table(name = "tracked_asset")
public class TrackedAsset {

    /** e.g. "BTC/USD" — natural PK, no surrogate needed. */
    @Id
    @Column(nullable = false, length = 32)
    private String symbol;

    @Column
    private Integer marketRank;

    @Column
    private Long marketCap;

    @Column
    private Long circulatingSupply;

    @Column(precision = 24, scale = 8)
    private BigDecimal allTimeHigh;

    @Column
    private Long athTimestamp;

    @Column(name = "change_24h")
    private Double change24h;

    @Column(name = "volume_24h")
    private Long volume24h;

    protected TrackedAsset() {
    }

    public TrackedAsset(
            String symbol,
            Integer marketRank,
            Long marketCap,
            Long circulatingSupply,
            BigDecimal allTimeHigh,
            Long athTimestamp,
            Double change24h,
            Long volume24h) {
        this.symbol = symbol;
        this.marketRank = marketRank;
        this.marketCap = marketCap;
        this.circulatingSupply = circulatingSupply;
        this.allTimeHigh = allTimeHigh;
        this.athTimestamp = athTimestamp;
        this.change24h = change24h;
        this.volume24h = volume24h;
    }

    public String getSymbol() {
        return symbol;
    }

    public Integer getMarketRank() {
        return marketRank;
    }

    public void setMarketRank(Integer marketRank) {
        this.marketRank = marketRank;
    }

    public Long getMarketCap() {
        return marketCap;
    }

    public void setMarketCap(Long marketCap) {
        this.marketCap = marketCap;
    }

    public Long getCirculatingSupply() {
        return circulatingSupply;
    }

    public void setCirculatingSupply(Long circulatingSupply) {
        this.circulatingSupply = circulatingSupply;
    }

    public BigDecimal getAllTimeHigh() {
        return allTimeHigh;
    }

    public void setAllTimeHigh(BigDecimal allTimeHigh) {
        this.allTimeHigh = allTimeHigh;
    }

    public Long getAthTimestamp() {
        return athTimestamp;
    }

    public void setAthTimestamp(Long athTimestamp) {
        this.athTimestamp = athTimestamp;
    }

    public Double getChange24h() {
        return change24h;
    }

    public void setChange24h(Double change24h) {
        this.change24h = change24h;
    }

    public Long getVolume24h() {
        return volume24h;
    }

    public void setVolume24h(Long volume24h) {
        this.volume24h = volume24h;
    }
}
