package com.matrix2121.cryptotrade.transactions.dao;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.transactions.TransactionMapper;
import com.matrix2121.cryptotrade.transactions.TransactionModel;

import java.util.List;

@Repository
public class TransactionDaoImpl implements TransactionDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public List<TransactionModel> findTransactionsByUserId(Long userId){
        return jdbcTemplate.queryForStream(
            "SELECT * FROM get_transactions_by_user_id(?)", 
            TransactionMapper.mapToTransactionModel(), 
            userId)
            .toList();
    }

    @Override
    public TransactionModel findTransactionByTransactionId(Long transactionId){
        return jdbcTemplate.queryForStream(
            "SELECT * FROM get_transaction_by_transaction_id(?)", 
            TransactionMapper.mapToTransactionModel(), 
            transactionId)
            .toList();
    }
}
