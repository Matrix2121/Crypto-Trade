package com.matrix2121.cryptotrade.marketdata.persistence;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

public class OhlcBucketId implements Serializable {

    private String symbol;
    private Instant bucket;

    protected OhlcBucketId() {
    }

    public OhlcBucketId(String symbol, Instant bucket) {
        this.symbol = symbol;
        this.bucket = bucket;
    }

    public String getSymbol() {
        return symbol;
    }

    public Instant getBucket() {
        return bucket;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof OhlcBucketId that)) {
            return false;
        }
        return Objects.equals(symbol, that.symbol) && Objects.equals(bucket, that.bucket);
    }

    @Override
    public int hashCode() {
        return Objects.hash(symbol, bucket);
    }
}
