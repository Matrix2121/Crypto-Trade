package com.matrix2121.cryptotrade.transactions.dao;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.exceptions.NoTransasctionsException;
import com.matrix2121.cryptotrade.exceptions.UserNotFoundException;
import com.matrix2121.cryptotrade.transactions.TransactionMapper;
import com.matrix2121.cryptotrade.transactions.TransactionModel;

import java.util.List;

@Repository
public class TransactionDaoImpl implements TransactionDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public List<TransactionModel> findTransactionsByUserId(Long userId) {
        checkIfUserExists(userId);
        checkIfUserHasTransactions(userId);

        return jdbcTemplate.queryForStream(
                "select * from get_transactions_by_user_id(?)",
                TransactionMapper.mapToTransactionModel(),
                userId)
                .toList();
    }

    @Override
    public TransactionModel findTransactionByTransactionId(Long transactionId) {
        checkIfTransactionExists(transactionId);

        return jdbcTemplate.queryForObject(
                "select * from get_transaction_by_transaction_id(?)",
                TransactionMapper.mapToTransactionModel(),
                transactionId);
    }

    private void checkIfUserExists(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ?",
                Integer.class,
                userId);
        if (count == null || count == 0) {
            throw new UserNotFoundException("User with ID " + userId + " not found");
        }
    }

    private boolean checkIfTransactionExists(Long transactionId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from transactions where id = ?",
                Integer.class,
                transactionId);
        if (count == null || count == 0) {
            throw new NoTransasctionsException("Transaction with ID " + transactionId + " not found");
        }
        return !(count > 0);
    }

    private boolean checkIfUserHasTransactions(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from transactions where user_id = ?",
                Integer.class,
                userId);
        if (count == null || count == 0) {
            throw new NoTransasctionsException("User with ID " + userId + " doesn't have transactions");
        }
        return !(count > 0);
    }
}
