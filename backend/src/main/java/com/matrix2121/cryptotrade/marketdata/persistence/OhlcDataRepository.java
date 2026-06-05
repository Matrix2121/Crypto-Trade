package com.matrix2121.cryptotrade.marketdata.persistence;

import java.util.List;

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

    @Query("SELECT MAX(o.timestamp) FROM OhlcData o WHERE o.symbol = :symbol AND o.intervalString = :interval")
    Long findMaxTimestampBySymbolAndIntervalString(
            @Param("symbol") String symbol,
            @Param("interval") String interval);
}
