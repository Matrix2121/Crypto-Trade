package com.matrix2121.cryptotrade.portfolio;

import org.springframework.jdbc.core.RowMapper;

public class AssetMapper {

    public static AssetDto mapToAssetDto(AssetModel assetModel) {
        return new AssetDto(
                assetModel.cryptoCode(),
                assetModel.cryptoAmount());
    }

    public static RowMapper<AssetModel> mapToAssetModel() {
        return (rs, i) -> new AssetModel(
                rs.getLong("id"),
                rs.getString("crypto_code"),
                rs.getBigDecimal("crypto_amount"),
                rs.getLong("user_id"));
    }
}
