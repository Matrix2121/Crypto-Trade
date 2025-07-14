package com.matrix2121.cryptotrade.balance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/balance")
public class BalanceController {

    @Autowired
    private BalanceService balanceService;

    @GetMapping("/{userId}")
    public BalanceDto getBalanceByUserId(@PathVariable Long userId) {
        return balanceService.getBalanceByUserId(userId);
    }
}
