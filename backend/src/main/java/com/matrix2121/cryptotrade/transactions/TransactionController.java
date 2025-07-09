package com.matrix2121.cryptotrade.transactions;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import com.matrix2121.cryptotrade.transactions.dtos.*;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    @Autowired
    private TransactionService transactionService;

    @GetMapping("/{userId}")
    public List<TransactionShortDto> getShortTransactionsByUserId(@PathVariable Long userId) {
        return transactionService.getShortTransactionsByUserId(userId);
    }

    @GetMapping("/{userId}")
    public TransactionLongDto getLongTransactionByTransactionId(@PathVariable Long transactionId) {
        return transactionService.getLongTransactionByTransactionId(transactionId);
    }
}
