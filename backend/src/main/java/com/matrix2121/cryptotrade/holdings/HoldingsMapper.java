package com.matrix2121.cryptotrade.holdings;

import org.springframework.jdbc.core.RowMapper;

public class HoldingsMapper {

    public static HoldingsDto mapToDto(HoldingsModel holdingsModel) {
        return new HoldingsDto(
            holdingsModel.cryptoCode(),
            holdingsModel.cryptoAmount()
        );
    }

    public static RowMapper<HoldingsModel> mapToModel(){
        return (rs, i) -> new HoldingsModel(
            rs.getLong("id"),
            rs.getString("crypto_code"),
            rs.getBigDecimal("crypto_amount"),
            rs.getLong("user_id"));
    }
}
