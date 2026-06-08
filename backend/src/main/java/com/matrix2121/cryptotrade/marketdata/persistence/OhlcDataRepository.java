package com.matrix2121.cryptotrade.marketdata.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OhlcDataRepository extends JpaRepository<OhlcData, Long> {

    List<OhlcData> findBySymbolAndIntervalStringAndTimestampGreaterThanEqualOrderByTimestampAsc(
            String symbol, String intervalString, Long timestamp);

    List<OhlcData> findBySymbolAndIntervalStringAndTimestampBetweenOrderByTimestampAsc(
            String symbol, String intervalString, Long startTimestamp, Long endTimestamp);

    Optional<OhlcData> findFirstBySymbolAndIntervalStringAndTimestampLessThanEqualOrderByTimestampDesc(
            String symbol, String intervalString, Long timestamp);

    Optional<OhlcData> findFirstBySymbolAndIntervalStringOrderByTimestampDesc(
            String symbol, String intervalString);

    Optional<OhlcData> findBySymbolAndIntervalStringAndTimestamp(
            String symbol, String intervalString, Long timestamp);

    @Query("SELECT MAX(o.timestamp) FROM OhlcData o WHERE o.symbol = :symbol AND o.intervalString = :interval")
    Long findMaxTimestampBySymbolAndIntervalString(
            @Param("symbol") String symbol,
            @Param("interval") String interval);

    @Query("SELECT MIN(o.timestamp) FROM OhlcData o WHERE o.symbol = :symbol AND o.intervalString = :interval")
    Long findMinTimestampBySymbolAndIntervalString(
            @Param("symbol") String symbol,
            @Param("interval") String interval);

    @Query("""
            SELECT o.timestamp FROM OhlcData o
            WHERE o.symbol = :symbol AND o.intervalString = :interval
              AND o.timestamp >= :start AND o.timestamp <= :end
            ORDER BY o.timestamp ASC
            """)
    List<Long> findTimestampsBySymbolAndIntervalAndTimestampBetween(
            @Param("symbol") String symbol,
            @Param("interval") String interval,
            @Param("start") Long startTimestamp,
            @Param("end") Long endTimestamp);

    boolean existsBySymbolAndIntervalStringAndTimestamp(
            String symbol, String intervalString, Long timestamp);

    long deleteBySymbolAndIntervalStringAndTimestampLessThan(
            String symbol, String intervalString, Long timestamp);
}
