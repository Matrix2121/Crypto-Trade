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

    @GetMapping("all/{userId}")
    public List<TransactionShortDto> getTransactionsByUserId(@PathVariable Long userId) {
        return transactionService.getTransactionsByUserId(userId);
    }

    @GetMapping("single/{transactionId}")
    public TransactionLongDto getTransactionByTransactionId(@PathVariable Long transactionId) {
        return transactionService.getTransactionByTransactionId(transactionId);
    }
}
