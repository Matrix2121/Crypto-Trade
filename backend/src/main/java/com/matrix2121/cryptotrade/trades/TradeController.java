package com.matrix2121.cryptotrade.trades;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.trades.dtos.*;


@RestController
@RequestMapping("/api/trade")
public class TradeController {
    
    @Autowired
    private TradeService tradeService;

    @PostMapping("/sell/{userId}")
    public TradeResponseDto sellCrypto(@PathVariable Long userId, @RequestBody TradeRequestDto tradeRequestDto){
        return tradeService.sellCrypto(userId, tradeRequestDto);
    }

    @PostMapping("/buy/{userId}")
    public TradeResponseDto buyCrypto(@PathVariable Long userId, @RequestBody TradeRequestDto tradeRequestDto){
        return tradeService.buyCrypto(userId, tradeRequestDto);
    }
}
