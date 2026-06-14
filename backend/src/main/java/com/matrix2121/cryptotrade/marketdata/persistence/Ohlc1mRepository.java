package com.matrix2121.cryptotrade.marketdata.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface Ohlc1mRepository extends JpaRepository<Ohlc1m, OhlcBucketId> {

    List<Ohlc1m> findBySymbolAndBucketGreaterThanEqualOrderByBucketAsc(
            String symbol, Instant bucket);

    Optional<Ohlc1m> findFirstBySymbolAndBucketLessThanEqualOrderByBucketDesc(
            String symbol, Instant bucket);

    Optional<Ohlc1m> findFirstBySymbolOrderByBucketDesc(String symbol);

    @Query("SELECT MAX(o.bucket) FROM Ohlc1m o WHERE o.symbol = :symbol")
    Instant findMaxBucketBySymbol(@Param("symbol") String symbol);

    @Query("SELECT MIN(o.bucket) FROM Ohlc1m o WHERE o.symbol = :symbol")
    Instant findMinBucketBySymbol(@Param("symbol") String symbol);

    @Query(value = """
            SELECT CAST(EXTRACT(EPOCH FROM o.bucket) * 1000 AS BIGINT)
            FROM ohlc_1m o
            WHERE o.symbol = :symbol
              AND o.bucket >= to_timestamp(:startMs / 1000.0)
              AND o.bucket <= to_timestamp(:endMs / 1000.0)
            ORDER BY o.bucket ASC
            """, nativeQuery = true)
    List<Long> findBucketEpochMsBetween(
            @Param("symbol") String symbol,
            @Param("startMs") long startMs,
            @Param("endMs") long endMs);

    boolean existsBySymbolAndBucket(String symbol, Instant bucket);
}
