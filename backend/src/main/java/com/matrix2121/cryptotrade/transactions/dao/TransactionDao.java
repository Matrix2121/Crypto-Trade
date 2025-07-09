package com.matrix2121.cryptotrade.transactions.dao;
import java.util.List;

import com.matrix2121.cryptotrade.transactions.TransactionModel;

public interface TransactionDao {
    public List<TransactionModel> findTransactionsByUserId(Long userId);
    public TransactionModel findTransactionByTransactionId(Long transactionId);
}
