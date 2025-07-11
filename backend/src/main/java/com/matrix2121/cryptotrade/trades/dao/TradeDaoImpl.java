package com.matrix2121.cryptotrade.trades.dao;

import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.trades.dtos.TradeResponseDto;

@Repository
public class TradeDaoImpl implements TradeDao{

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public TradeResponseDto sellCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice) {
        String sqlCall = "call sell_crypto(?, ? ,?, ?, ? ,?, ?, ? ,?, ?, ?)";
        List<SqlParameter> params = List.of(
            new SqlParameter("p_user_id", Types.BIGINT),
            new SqlParameter("p_crypto_code", Types.VARCHAR),
            new SqlParameter("p_crypto_amount", Types.NUMERIC),
            new SqlParameter("p_unit_price", Types.NUMERIC),

            new SqlOutParameter("out_crypto_code", Types.VARCHAR),
            new SqlOutParameter("out_crypto_amount", Types.NUMERIC),
            new SqlOutParameter("out_unit_price", Types.NUMERIC),
            new SqlOutParameter("out_old_crypto_balance", Types.NUMERIC),
            new SqlOutParameter("out_new_crypto_balance", Types.NUMERIC),
            new SqlOutParameter("out_fiat_gained", Types.NUMERIC),
            new SqlOutParameter("out_timestamp", Types.TIMESTAMP)
        );


        Map<String, Object> result = jdbcTemplate.call(
            (Connection con) -> {
                CallableStatement cs = con.prepareCall(sqlCall);
                
                cs.setLong   (1, userId);
                cs.setString (2, cryptoCode);
                cs.setBigDecimal(3, cryptoAmount);
                cs.setBigDecimal(4, unitPrice);

                cs.registerOutParameter(5,  Types.VARCHAR);
                cs.registerOutParameter(6,  Types.NUMERIC);
                cs.registerOutParameter(7,  Types.NUMERIC);
                cs.registerOutParameter(8,  Types.NUMERIC);
                cs.registerOutParameter(9,  Types.NUMERIC);
                cs.registerOutParameter(10, Types.NUMERIC);
                cs.registerOutParameter(11, Types.TIMESTAMP);
                
                return cs;
            }, params);

        return new TradeResponseDto(
            (String) result.get("out_crypto_code"),
            (BigDecimal) result.get("out_crypto_amount"),
            (BigDecimal) result.get("out_unit_price"),
            (BigDecimal) result.get("out_old_crypto_balance"),
            (BigDecimal) result.get("out_new_crypto_balance"),
            (BigDecimal) result.get("out_fiat_gained"),
            ((Timestamp) (result.get("out_timestamp"))).toInstant()
        );
    }

    @Override
    public TradeResponseDto buyCrypto(Long userId, String cryptoCode, BigDecimal cryptoAmount, BigDecimal unitPrice) {
        String sqlCall = "call buy_crypto(?, ? ,?, ?, ? ,?, ?, ? ,?, ?, ?)";
        List<SqlParameter> params = List.of(
            new SqlParameter("p_user_id", Types.BIGINT),
            new SqlParameter("p_crypto_code", Types.VARCHAR),
            new SqlParameter("p_crypto_amount", Types.NUMERIC),
            new SqlParameter("p_unit_price", Types.NUMERIC),

            new SqlOutParameter("out_crypto_code", Types.VARCHAR),
            new SqlOutParameter("out_crypto_amount", Types.NUMERIC),
            new SqlOutParameter("out_unit_price", Types.NUMERIC),
            new SqlOutParameter("out_old_crypto_balance", Types.NUMERIC),
            new SqlOutParameter("out_new_crypto_balance", Types.NUMERIC),
            new SqlOutParameter("out_fiat_paid", Types.NUMERIC),
            new SqlOutParameter("out_timestamp", Types.TIMESTAMP)
        );


        Map<String, Object> result = jdbcTemplate.call(
            (Connection con) -> {
                CallableStatement cs = con.prepareCall(sqlCall);
                
                cs.setLong   (1, userId);
                cs.setString (2, cryptoCode);
                cs.setBigDecimal(3, cryptoAmount);
                cs.setBigDecimal(4, unitPrice);

                cs.registerOutParameter(5,  Types.VARCHAR);
                cs.registerOutParameter(6,  Types.NUMERIC);
                cs.registerOutParameter(7,  Types.NUMERIC);
                cs.registerOutParameter(8,  Types.NUMERIC);
                cs.registerOutParameter(9,  Types.NUMERIC);
                cs.registerOutParameter(10, Types.NUMERIC);
                cs.registerOutParameter(11, Types.TIMESTAMP);
                
                return cs;
            }, params);

        return new TradeResponseDto(
            (String) result.get("out_crypto_code"),
            (BigDecimal) result.get("out_crypto_amount"),
            (BigDecimal) result.get("out_unit_price"),
            (BigDecimal) result.get("out_old_crypto_balance"),
            (BigDecimal) result.get("out_new_crypto_balance"),
            (BigDecimal) result.get("out_fiat_paid"),
            ((Timestamp) (result.get("out_timestamp"))).toInstant()
        );
    }
    
}
