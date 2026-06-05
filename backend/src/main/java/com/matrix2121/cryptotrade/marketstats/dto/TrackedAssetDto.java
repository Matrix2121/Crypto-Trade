package com.matrix2121.cryptotrade.marketstats.dto;

import java.math.BigDecimal;

import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;

public record TrackedAssetDto(
        String symbol,
        Integer marketRank,
        Long marketCap,
        Long circulatingSupply,
        BigDecimal allTimeHigh,
        Long athTimestamp,
        Double change24h,
        Long volume24h) {

    public static TrackedAssetDto from(TrackedAsset asset) {
        return new TrackedAssetDto(
                asset.getSymbol(),
                asset.getMarketRank(),
                asset.getMarketCap(),
                asset.getCirculatingSupply(),
                asset.getAllTimeHigh(),
                asset.getAthTimestamp(),
                asset.getChange24h(),
                asset.getVolume24h());
    }

    public static TrackedAssetDto empty(String symbol) {
        return new TrackedAssetDto(symbol, null, null, null, null, null, null, null);
    }
}
