package com.matrix2121.cryptotrade.transactions;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.transactions.dao.TransactionDao;
import com.matrix2121.cryptotrade.transactions.dtos.*;

@Service
public class TransactionService {

    @Autowired
    private TransactionDao transactionDao;

    public List<TransactionShortDto> getTransactionsByUserId(Long userId) {
        List<TransactionModel> assetModelList = transactionDao.findTransactionsByUserId(userId);
        return assetModelList.stream()
            .map(TransactionMapper::mapToTransactionShortDto)
            .toList();
    }

    public TransactionLongDto getTransactionByTransactionId(Long transactionId) {
        List<TransactionModel> assetModelList = transactionDao.findTransactionByTransactionId(usertransactionIdId);
        return assetModelList.stream()
            .map(TransactionMapper::mapToTransactionLongDto)
            .toList();
    }

}
