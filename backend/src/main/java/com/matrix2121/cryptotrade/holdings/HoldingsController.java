package com.matrix2121.cryptotrade.holdings;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/holdings")
public class HoldingsController {

    @Autowired
    private HoldingsService service;

    @GetMapping("/{userId}")
    public List<HoldingsDto> getHoldingsByUserId(@PathVariable Long userId) {
        return service.getHoldingsByUserId(userId);
    }
}
