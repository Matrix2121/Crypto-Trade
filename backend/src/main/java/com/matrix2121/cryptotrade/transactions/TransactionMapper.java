package com.matrix2121.cryptotrade.transactions;

import org.springframework.jdbc.core.RowMapper;

import com.matrix2121.cryptotrade.transactions.dtos.*;

public class TransactionMapper {

    public static TransactionShortDto mapToTransactionShortDto(TransactionModel transactionModel) {
        return new TransactionShortDto(
            transactionModel.id(),
            transactionModel.cryptoCode(),
            transactionModel.cryptoAmount(),
            transactionModel.isPurchase()
        );
    }

    public static TransactionLongDto mapToTransactionLongDto(TransactionModel transactionModel) {
        return new TransactionLongDto(
            transactionModel.id(),
            transactionModel.cryptoCode(),
            transactionModel.unitPrice(),
            transactionModel.cryptoAmount(),
            transactionModel.localCurrencyAmount(),
            transactionModel.isPurchase(),
            transactionModel.tradeTimestamp()
        );
    }

    public static RowMapper<TransactionModel> mapToTransactionModel(){
        return (rs, i) -> new TransactionModel(
            rs.getLong("id"),
            rs.getString("crypto_code"),
            rs.getBigDecimal("unit_price"),
            rs.getBigDecimal("crypto_amount"),
            rs.getBigDecimal("local_currency_amount"),
            rs.getBoolean("is_purchase"),
            rs.getTimestamp("trade_timestamp").toInstant(),
            rs.getLong("user_id"));
    }
}
